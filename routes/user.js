const express  = require("express");
const router   = express.Router();
const User     = require("../models/user.js");
const Listing  = require("../models/listing.js");
const wrapAsync    = require("../utils/wrapAsync.js");
const passport     = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const multer  = require("multer");
const { storage, cloudinary } = require("../cloudConfig.js");
const upload = multer({ storage });
const crypto = require("crypto");

// ─── Signup GET ───────────────────────────────────────────────────────────────
router.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

// ─── Signup POST ──────────────────────────────────────────────────────────────
// NEW FEATURE: After signup, sets an email verification token on the user
// and would send a verification email (nodemailer). In dev, the token is
// flashed so the user can confirm without actual email.
router.post("/signup", wrapAsync(async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const newUser = new User({ email, username });

    // NEW FEATURE: Generate email verification token
    // A random hex string that is emailed to the user via a /verify-email link
    newUser.emailVerificationToken = crypto.randomBytes(20).toString("hex");

    const registeredUser = await User.register(newUser, password);

    // In a real deployment, you'd send an email here via nodemailer:
    // await sendVerificationEmail(registeredUser.email, registeredUser.emailVerificationToken);

    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", `Welcome to WanderLust, ${username}! 🌍 (Dev: verify token = ${registeredUser.emailVerificationToken.substring(0,8)}...)`);
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
}));

// ─── Login GET ────────────────────────────────────────────────────────────────
router.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

// ─── Login POST ───────────────────────────────────────────────────────────────
router.post(
  "/login",
  saveRedirectUrl,
  passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }),
  async (req, res) => {
    req.flash("success", `Welcome back, ${req.user.username}! 👋`);
    const redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
  }
);

// ─── Logout ───────────────────────────────────────────────────────────────────
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You have been logged out. See you soon!");
    res.redirect("/listings");
  });
});

// ─── NEW FEATURE: Email verification route ────────────────────────────────────
// GET /verify-email?token=xxx
// User clicks the link in their verification email.
// We find the user by token, mark them as verified, and clear the token.
router.get("/verify-email", wrapAsync(async (req, res) => {
  const { token } = req.query;
  if (!token) {
    req.flash("error", "Invalid verification link.");
    return res.redirect("/listings");
  }

  const user = await User.findOne({ emailVerificationToken: token });
  if (!user) {
    req.flash("error", "Verification token is invalid or has expired.");
    return res.redirect("/listings");
  }

  user.emailVerified           = true;
  user.emailVerificationToken  = "";
  await user.save();

  req.flash("success", "Email verified! Your account is fully active.");
  res.redirect("/listings");
}));

// ─── NEW FEATURE: Forgot Password flow ───────────────────────────────────────
// GET /forgot — show form where user enters their email
// Without this, any user who forgets their password is permanently locked out
router.get("/forgot", (req, res) => {
  res.render("users/forgot.ejs");
});

// ─── POST /forgot — generate reset token and "email" it ──────────────────────
// Sets a 1-hour expiry reset token on the user and would send reset email.
// In dev, flashes the token directly so it can be tested without email setup.
router.post("/forgot", wrapAsync(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    // Don't reveal whether the email exists (security best practice)
    req.flash("success", "If that email is registered, a reset link has been sent.");
    return res.redirect("/forgot");
  }

  const token = crypto.randomBytes(20).toString("hex");
  user.resetPasswordToken   = token;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
  await user.save();

  // In production, send email here:
  // await sendResetEmail(user.email, token);
  req.flash("success", `Dev mode — reset token: ${token.substring(0,8)}... Use /reset?token=${token}`);
  res.redirect("/login");
}));

// ─── GET /reset?token=xxx — show new password form ───────────────────────────
router.get("/reset", wrapAsync(async (req, res) => {
  const { token } = req.query;
  const user = await User.findOne({
    resetPasswordToken:   token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) {
    req.flash("error", "Password reset token is invalid or has expired.");
    return res.redirect("/forgot");
  }
  res.render("users/reset.ejs", { token });
}));

// ─── POST /reset — apply new password ─────────────────────────────────────────
// NEW FEATURE: Complete forgot-password flow. Sets the new password,
// clears the reset token, and logs the user in automatically.
router.post("/reset", wrapAsync(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetPasswordToken:   token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Password reset token is invalid or has expired.");
    return res.redirect("/forgot");
  }

  await user.setPassword(password); // passport-local-mongoose method
  user.resetPasswordToken   = "";
  user.resetPasswordExpires = undefined;
  await user.save();

  req.login(user, (err) => {
    if (err) return next(err);
    req.flash("success", "Password reset successful! Welcome back.");
    res.redirect("/listings");
  });
}));

// ─── Profile Route ────────────────────────────────────────────────────────────
// NEW FEATURE: Extended profile with bio, photo, total reviews, avg rating,
// years hosting (from createdAt timestamp), and wishlist section
router.get("/profile/:username", wrapAsync(async (req, res) => {
  const { username } = req.params;
  const profileUser = await User.findOne({ username });
  if (!profileUser) {
    req.flash("error", "User not found!");
    return res.redirect("/listings");
  }

  const userListings = await Listing.find({ owner: profileUser._id }).populate("reviews");

  // Aggregate total reviews and average rating across all listings
  let totalReviews = 0;
  let ratingSum    = 0;
  for (const listing of userListings) {
    totalReviews += listing.reviews.length;
    for (const review of listing.reviews) {
      ratingSum += review.rating || 0;
    }
  }
  const avgRating   = totalReviews > 0 ? (ratingSum / totalReviews).toFixed(1) : 0;

  // NEW: years hosting from account createdAt
  const yearsHosting = Math.max(1, Math.floor(
    (Date.now() - new Date(profileUser.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  ));

  // NEW: load saved/wishlist listings for current user's own profile
  let wishlistListings = [];
  if (req.user && req.user._id.equals(profileUser._id)) {
    wishlistListings = await Listing.find({ _id: { $in: req.user.wishlist } });
  }

  res.render("users/profile.ejs", {
    profileUser,
    userListings,
    totalReviews,
    avgRating,
    yearsHosting,
    wishlistListings,
  });
}));

// ─── NEW FEATURE: Update profile (bio + photo) ────────────────────────────────
// POST /profile/:username/edit — allows user to update their bio and profile photo
// Profile photo is uploaded to Cloudinary via multer
router.post(
  "/profile/:username/edit",
  isLoggedIn,
  upload.single("profilePhoto"),
  wrapAsync(async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    if (!user || !user._id.equals(req.user._id)) {
      req.flash("error", "You can only edit your own profile.");
      return res.redirect(`/profile/${req.params.username}`);
    }

    // Update bio
    if (req.body.bio !== undefined) user.bio = req.body.bio;

    // NEW FEATURE: Upload new profile photo to Cloudinary
    if (req.file) {
      // Delete old photo from Cloudinary if it exists
      if (user.profilePhoto && user.profilePhoto.filename) {
        await cloudinary.uploader.destroy(user.profilePhoto.filename);
      }
      user.profilePhoto = { url: req.file.path, filename: req.file.filename };
    }

    await user.save();
    req.flash("success", "Profile updated!");
    res.redirect(`/profile/${user.username}`);
  })
);

// ─── NEW FEATURE: Wishlist page ───────────────────────────────────────────────
// GET /wishlist — shows all listings the logged-in user has saved
router.get("/wishlist", isLoggedIn, wrapAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  const listings = await Listing.find({ _id: { $in: user.wishlist } }).populate("reviews");
  res.render("users/wishlist.ejs", { listings });
}));

module.exports = router;
