const Listing  = require("./models/listing.js");
const Review   = require("./models/review.js");
const Booking  = require("./models/booking.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema, bookingSchema } = require("./schema.js");

// ─── isLoggedIn ───────────────────────────────────────────────────────────────
// Checks if the user is authenticated via Passport session.
// If not, saves the current URL so we can redirect back after login.
// Used on: new listing, create listing, edit, delete, booking, review, wishlist
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to do that!");
    return res.redirect("/login");
  }
  next();
};

// ─── saveRedirectUrl ──────────────────────────────────────────────────────────
// Passport clears session on login, so we save the redirect URL into res.locals
// BEFORE authentication happens, then read it back in the login POST handler.
module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

// ─── isOwner ──────────────────────────────────────────────────────────────────
// Checks that the currently-logged-in user owns the listing being edited/deleted.
// Prevents any authenticated user from modifying another user's listing.
module.exports.isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing.owner.equals(res.locals.currUser._id)) {
    req.flash("error", "You don't have permission to do that!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

// ─── isReviewAuthor ───────────────────────────────────────────────────────────
// Checks that the currently-logged-in user wrote the review being deleted.
module.exports.isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review.author.equals(res.locals.currUser._id)) {
    req.flash("error", "You didn't write this review!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

// NEW FEATURE: isBookingGuest ──────────────────────────────────────────────────
// Checks that the currently-logged-in user made the booking being viewed/cancelled.
// Prevents users from viewing or cancelling other users' bookings.
module.exports.isBookingGuest = async (req, res, next) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    req.flash("error", "Booking not found!");
    return res.redirect("/bookings");
  }
  if (!booking.guest.equals(res.locals.currUser._id)) {
    req.flash("error", "That's not your booking!");
    return res.redirect("/bookings");
  }
  next();
};

// ─── validateListing ─────────────────────────────────────────────────────────
// Joi server-side validation for listing create/update.
// Runs AFTER multer (so req.body is populated) but BEFORE the DB write.
module.exports.validateListing = (req, res, next) => {
  // Normalise amenities: HTML checkboxes send a single string when only one is checked
  if (req.body.listing && req.body.listing.amenities) {
    if (typeof req.body.listing.amenities === "string") {
      req.body.listing.amenities = [req.body.listing.amenities];
    }
  } else if (req.body.listing) {
    req.body.listing.amenities = [];
  }

  // Normalise boolean fields from checkbox ("on" / undefined → true / false)
  if (req.body.listing && req.body.listing.houseRules) {
    const hr = req.body.listing.houseRules;
    hr.smokingAllowed = hr.smokingAllowed === "on";
    hr.petsAllowed    = hr.petsAllowed    === "on";
    hr.partiesAllowed = hr.partiesAllowed === "on";
  }

  const { error } = listingSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  }
  next();
};

// ─── validateReview ───────────────────────────────────────────────────────────
// Joi server-side validation for review create.
module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  }
  next();
};

// NEW FEATURE: validateBooking ─────────────────────────────────────────────────
// Joi server-side validation for booking create.
// Prevents manipulated dates (checkOut before checkIn, past dates, etc.)
module.exports.validateBooking = (req, res, next) => {
  const { error } = bookingSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  }
  next();
};
