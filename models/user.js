const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

// ─────────────────────────────────────────────────────────────────────────────
// NEW FEATURE: Extended User schema
// Previously only stored email. Now includes bio, profilePhoto, phone,
// isVerified flag, and timestamps so hosts look trustworthy on their profile page.
// ─────────────────────────────────────────────────────────────────────────────
const userSchema = new Schema(
  {
    email: { type: String, required: true },

    // NEW FEATURE: Host profile completeness fields
    // Airbnb shows bio, profile photo, years hosting, response rate.
    // Without this, guests cannot judge if a host is trustworthy.
    bio: { type: String, default: "" },

    // NEW FEATURE: Profile photo URL (from Cloudinary)
    // Stored as { url, filename } so it can be replaced / deleted from Cloudinary
    profilePhoto: {
      url:      { type: String, default: "" },
      filename: { type: String, default: "" },
    },

    // NEW FEATURE: Phone number field
    // Real platforms require phone verification before allowing someone to list
    phone: { type: String, default: "" },

    // NEW FEATURE: Phone verified flag
    // Set to true after OTP verification (OTP logic hooks into this field)
    phoneVerified: { type: Boolean, default: false },

    // NEW FEATURE: Email verified flag
    // Set to true after clicking the email verification link
    // Without email verification, anyone can sign up with a fake email
    emailVerified: { type: Boolean, default: false },

    // NEW FEATURE: Email verification token
    // Random hex token emailed to user — compared on /verify-email route
    emailVerificationToken: { type: String, default: "" },

    // NEW FEATURE: Password reset token (Forgot Password flow)
    // Without this, users who forget their password are permanently locked out
    resetPasswordToken:   { type: String,  default: "" },
    resetPasswordExpires: { type: Date },

    // NEW FEATURE: Wishlist — array of listing IDs the user has saved
    // Allows guests to browse, save favourites, and come back without remembering URLs
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
  },
  { timestamps: true }
);

// passport-local-mongoose automatically adds: username, password (hashed+salted),
// and helper methods: authenticate(), serializeUser(), deserializeUser()
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
