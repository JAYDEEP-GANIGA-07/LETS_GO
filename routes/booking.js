const express  = require("express");
const router   = express.Router();
const Listing  = require("../models/listing.js");
const Booking  = require("../models/booking.js");
const wrapAsync    = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { isLoggedIn, isBookingGuest } = require("../middleware.js");
const crypto = require("crypto");

// ─── Helper: random confirmation code e.g. "WL-A3F9K2" ──────────────────────
function generateConfirmationCode() {
  return "WL-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

// ─── Helper: server-side price calculation ───────────────────────────────────
// All pricing computed server-side — can't be tampered by the browser form
function calcPricing(listing, checkIn, checkOut) {
  const msPerDay   = 1000 * 60 * 60 * 24;
  const nights     = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / msPerDay));
  const subtotal   = listing.price * nights;
  const gst        = Math.round(subtotal * 0.18);   // 18% GST
  const serviceFee = Math.round(subtotal * 0.05);   // 5% platform fee
  const total      = subtotal + gst + serviceFee;
  return { nights, subtotal, gst, serviceFee, total };
}

// ─── GET /listings/:id/book — booking form page ──────────────────────────────
router.get("/listings/:id/book", isLoggedIn, wrapAsync(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  if (listing.owner.equals(req.user._id)) {
    req.flash("error", "You cannot book your own listing!");
    return res.redirect(`/listings/${listing._id}`);
  }

  // Pass confirmed bookings so the date picker can highlight blocked dates
  const existingBookings = await Booking.find({
    listing: listing._id,
    status:  "confirmed",
  }).select("checkIn checkOut");

  res.render("bookings/new.ejs", { listing, existingBookings });
}));

// ─── POST /bookings — create booking (dummy instant confirm) ─────────────────
// FIX: The form sends fields in multiple ways depending on which page posts it.
// We now read listingId from ALL possible locations in req.body:
//   - req.body.listingId              (plain hidden field)
//   - req.body.listing.listingId      (nested as listing[listingId])
//   - req.body.booking.listingId      (nested as booking[listingId])
// Dates/guests come from booking[checkIn] etc. → available in req.body.booking
router.post("/bookings", isLoggedIn, wrapAsync(async (req, res) => {
  // Pull listingId from wherever the form put it
  const listingId =
    req.body.listingId ||
    (req.body.listing  && req.body.listing.listingId) ||
    (req.body.booking  && req.body.booking.listingId);

  // Pull dates & guests from booking[...] fields
  const booking_data = req.body.booking || {};
  const checkIn  = booking_data.checkIn  || req.body.checkIn;
  const checkOut = booking_data.checkOut || req.body.checkOut;
  const guests   = booking_data.guests   || req.body.guests   || 1;
  const specialRequests = booking_data.specialRequests || req.body.specialRequests || "";

  // Debug log so you can see exactly what came in
  console.log("📦 Booking POST body:", JSON.stringify(req.body, null, 2));
  console.log("📌 Resolved — listingId:", listingId, "| checkIn:", checkIn, "| checkOut:", checkOut, "| guests:", guests);

  if (!listingId) {
    req.flash("error", "Could not find listing. Please try again.");
    return res.redirect("/listings");
  }

  const listing = await Listing.findById(listingId);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Host can't book own listing
  if (listing.owner.equals(req.user._id)) {
    req.flash("error", "You cannot book your own listing!");
    return res.redirect(`/listings/${listingId}`);
  }

  // Validate dates exist
  if (!checkIn || !checkOut) {
    req.flash("error", "Please select both check-in and checkout dates.");
    return res.redirect(`/listings/${listingId}/book`);
  }

  const ciDate = new Date(checkIn);
  const coDate = new Date(checkOut);

  if (isNaN(ciDate) || isNaN(coDate)) {
    req.flash("error", "Invalid dates. Please try again.");
    return res.redirect(`/listings/${listingId}/book`);
  }

  if (coDate <= ciDate) {
    req.flash("error", "Checkout must be after check-in.");
    return res.redirect(`/listings/${listingId}/book`);
  }

  // Guest count check (only if maxGuests is set on listing)
  const maxG = listing.maxGuests || 99;
  if (Number(guests) > maxG) {
    req.flash("error", `This listing fits a maximum of ${maxG} guests.`);
    return res.redirect(`/listings/${listingId}/book`);
  }

  // Date conflict check against existing confirmed bookings
  const conflict = await Booking.findOne({
    listing: listingId,
    status:  "confirmed",
    $or: [
      { checkIn:  { $lt: coDate,   $gte: ciDate   } },
      { checkOut: { $gt: ciDate,   $lte: coDate   } },
      { checkIn:  { $lte: ciDate }, checkOut: { $gte: coDate } },
    ],
  });

  if (conflict) {
    req.flash("error", "Those dates are already booked. Please choose different dates.");
    return res.redirect(`/listings/${listingId}/book`);
  }

  // Calculate server-side pricing
  const { nights, subtotal, gst, serviceFee, total } = calcPricing(listing, ciDate, coDate);

  // DUMMY PAYMENT: instantly confirms — no real payment gateway needed.
  // To add Razorpay later, replace this block with order creation + HMAC verify.
  const newBooking = new Booking({
    listing:           listingId,
    guest:             req.user._id,
    checkIn:           ciDate,
    checkOut:          coDate,
    guests:            Number(guests),
    basePricePerNight: listing.price,
    nights,
    subtotal,
    gst,
    serviceFee,
    totalAmount:       total,
    confirmationCode:  generateConfirmationCode(),
    specialRequests,
    status:            "confirmed",
    paymentStatus:     "paid",
  });

  await newBooking.save();
  req.flash("success", "🎉 Booking confirmed! Your stay is all set.");
  res.redirect(`/bookings/${newBooking._id}`);
}));

// ─── GET /bookings — list all logged-in user's bookings (the calendar icon) ──
// This is what the 📅 calendar icon in the navbar links to
router.get("/bookings", isLoggedIn, wrapAsync(async (req, res) => {
  const bookings = await Booking.find({ guest: req.user._id })
    .populate("listing")
    .sort({ checkIn: 1 }); // ascending so upcoming shows first

  res.render("bookings/index.ejs", { bookings });
}));

// ─── GET /bookings/:bookingId — booking receipt ───────────────────────────────
router.get("/bookings/:bookingId", isLoggedIn, isBookingGuest, wrapAsync(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId)
    .populate("listing")
    .populate("guest");

  if (!booking) {
    req.flash("error", "Booking not found!");
    return res.redirect("/bookings");
  }

  res.render("bookings/show.ejs", { booking });
}));

// ─── POST /bookings/:bookingId/cancel — cancel a booking ─────────────────────
router.post("/bookings/:bookingId/cancel", isLoggedIn, isBookingGuest, wrapAsync(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");

  if (!booking) {
    req.flash("error", "Booking not found!");
    return res.redirect("/bookings");
  }

  if (booking.status === "cancelled") {
    req.flash("error", "This booking is already cancelled.");
    return res.redirect(`/bookings/${booking._id}`);
  }

  const daysToCheckIn = (new Date(booking.checkIn) - new Date()) / (1000 * 60 * 60 * 24);
  const policy = (booking.listing && booking.listing.cancellationPolicy) || "moderate";

  let refundMessage = "No refund per the cancellation policy.";
  if      (policy === "flexible" && daysToCheckIn >= 1)  refundMessage = "Full refund within 5-7 business days.";
  else if (policy === "moderate" && daysToCheckIn >= 5)  refundMessage = "Full refund within 5-7 business days.";
  else if (policy === "moderate" && daysToCheckIn >= 1)  refundMessage = "50% refund within 5-7 business days.";
  else if (policy === "strict"   && daysToCheckIn >= 7)  refundMessage = "50% refund within 5-7 business days.";

  booking.status           = "cancelled";
  booking.cancelledAt      = new Date();
  booking.cancelledBy      = req.user._id;
  booking.cancellationNote = req.body.cancellationNote || "";
  await booking.save();

  req.flash("success", `Booking cancelled. ${refundMessage}`);
  res.redirect("/bookings");
}));

module.exports = router;
