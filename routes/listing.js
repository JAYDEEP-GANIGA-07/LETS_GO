const express  = require("express");
const router   = express.Router();
const Listing  = require("../models/listing.js");
const wrapAsync    = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");

const multer  = require("multer");
const { storage } = require("../cloudConfig.js");
// NEW FEATURE: upload.array("listing[images]", 10) allows multiple images per listing
// Previously only upload.single() was used — now up to 10 photos can be uploaded at once
const upload = multer({ storage });

// ─── INDEX ROUTE ──────────────────────────────────────────────────────────────
// NEW FEATURE: Category filtering + search combined
// Previously, category pills were decorative-only icons with no DB query.
// Now ?category=mountains actually filters listings from the DB.
// ?search= does case-insensitive regex match on title, location, country.
// Both params work together (e.g., Mountains + "India").
// NEW FEATURE: Price range filter via ?minPrice=&maxPrice=
// NEW FEATURE: Guest count filter via ?guests=
router.get("/", wrapAsync(async (req, res) => {
  const { search, category, minPrice, maxPrice, guests } = req.query;

  let filter = {};

  // Apply category filter if a category pill was clicked
  if (category && category.trim() !== "") {
    filter.category = category;
  }

  // Apply keyword search across title, location, country
  if (search && search.trim() !== "") {
    filter.$or = [
      { title:    { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { country:  { $regex: search, $options: "i" } },
    ];
  }

  // NEW FEATURE: Price range filter
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  // NEW FEATURE: Guest count filter — only show listings that can accommodate N guests
  if (guests && Number(guests) > 0) {
    filter.maxGuests = { $gte: Number(guests) };
  }

  const allListings = await Listing.find(filter).populate("reviews");

  res.render("listings/index.ejs", {
    allListings,
    search:    search    || "",
    category:  category  || "",
    minPrice:  minPrice  || "",
    maxPrice:  maxPrice  || "",
    guests:    guests    || "",
  });
}));

// ─── NEW ROUTE ────────────────────────────────────────────────────────────────
router.get("/new", isLoggedIn, (req, res) => {
  res.render("listings/new.ejs");
});

// ─── CREATE ROUTE ─────────────────────────────────────────────────────────────
// NEW FEATURE: upload.array("listing[images]", 10) — multiple image upload
// All uploaded files go to Cloudinary via multer-storage-cloudinary.
// If no files uploaded, falls back gracefully (no crash).
router.post(
  "/",
  isLoggedIn,
  upload.array("listing[images]", 10),
  validateListing,
  wrapAsync(async (req, res) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;

    // NEW FEATURE: store all uploaded images in the images[] array
    if (req.files && req.files.length > 0) {
      newListing.images = req.files.map((f) => ({
        url:      f.path,
        filename: f.filename,
      }));
      // Also populate legacy image field with first photo for backward compat
      newListing.image = { url: req.files[0].path, filename: req.files[0].filename };
    }

    await newListing.save();
    req.flash("success", "New listing created! 🎉");
    res.redirect("/listings");
  })
);

// ─── SHOW ROUTE ───────────────────────────────────────────────────────────────
// NEW FEATURE: Populates reviews with author, and fetches similar listings
// based on same category for the "Similar listings" section on the show page
router.get("/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // NEW FEATURE: Similar listings — same category, exclude current listing
  const similarListings = await Listing.find({
    category: listing.category,
    _id:      { $ne: listing._id },
  })
    .limit(3)
    .populate("reviews");

  // NEW FEATURE: Check if current user has wishlisted this listing
  let isSaved = false;
  if (req.user) {
    isSaved = listing.savedBy.some((uid) => uid.equals(req.user._id));
  }

  res.render("listings/show.ejs", { listing, similarListings, isSaved });
}));

// ─── EDIT ROUTE ───────────────────────────────────────────────────────────────
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  res.render("listings/edit.ejs", { listing });
}));

// ─── UPDATE ROUTE ─────────────────────────────────────────────────────────────
// NEW FEATURE: upload.array for multi-image update.
// NEW FEATURE: deleteImages[] array lets host remove existing photos selectively
// (checked checkboxes in edit form → filenames passed as deleteImages[])
router.put(
  "/:id",
  isLoggedIn,
  isOwner,
  upload.array("listing[images]", 10),
  validateListing,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing }, { new: true });

    // NEW FEATURE: Add newly uploaded images to the listing's images array
    if (req.files && req.files.length > 0) {
      const newImgs = req.files.map((f) => ({ url: f.path, filename: f.filename }));
      listing.images.push(...newImgs);
      // Update legacy single image field with the most recent upload
      listing.image = { url: req.files[0].path, filename: req.files[0].filename };
    }

    // NEW FEATURE: Delete selected images from Cloudinary + remove from DB array
    // deleteImages[] is an array of Cloudinary public_ids from checked checkboxes
    if (req.body.deleteImages && req.body.deleteImages.length > 0) {
      const { cloudinary } = require("../cloudConfig.js");
      for (const filename of req.body.deleteImages) {
        await cloudinary.uploader.destroy(filename);
      }
      listing.images = listing.images.filter(
        (img) => !req.body.deleteImages.includes(img.filename)
      );
    }

    await listing.save();
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
  })
);

// ─── DELETE ROUTE ─────────────────────────────────────────────────────────────
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
  const { id } = req.params;
  // Mongoose post-hook on findOneAndDelete cascades and deletes all reviews
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
}));

// ─── NEW FEATURE: Wishlist / Save toggle route ────────────────────────────────
// POST /listings/:id/save  — toggles the listing in user's wishlist
// If already saved → removes it (unsave). If not saved → adds it (save).
// Also updates the listing's savedBy[] array for reverse-lookup.
router.post("/:id/save", isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  const user    = req.user;

  const alreadySaved = listing.savedBy.some((uid) => uid.equals(user._id));

  if (alreadySaved) {
    // Remove from both sides
    listing.savedBy.pull(user._id);
    user.wishlist.pull(id);
    await listing.save();
    await user.save();
    return res.json({ saved: false, message: "Removed from wishlist" });
  } else {
    // Add to both sides
    listing.savedBy.push(user._id);
    user.wishlist.push(id);
    await listing.save();
    await user.save();
    return res.json({ saved: true, message: "Saved to wishlist" });
  }
}));

// ─── NEW FEATURE: Report listing route ───────────────────────────────────────
// POST /listings/:id/report — records the user's report flag on the listing
// Prevents duplicate reports from the same user via a Set-like check
router.post("/:id/report", isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  const alreadyReported = listing.reportedBy.some((uid) => uid.equals(req.user._id));
  if (alreadyReported) {
    req.flash("error", "You've already reported this listing.");
    return res.redirect(`/listings/${id}`);
  }

  listing.reportedBy.push(req.user._id);
  await listing.save();
  req.flash("success", "Thank you for reporting. Our team will review this listing.");
  res.redirect(`/listings/${id}`);
}));

module.exports = router;
