const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ─────────────────────────────────────────────────────────────────────────────
// NEW MODEL: Booking
// This is THE core business function that was completely missing.
// Without a booking system, WanderLust is just a photo gallery.
// This model stores every reservation: who booked, which listing, which dates,
// how many guests, total price, payment status, and booking status.
// ─────────────────────────────────────────────────────────────────────────────
const bookingSchema = new Schema(
  {
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },

    guest: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Check-in and check-out dates chosen by the guest in the booking widget
    checkIn:  { type: Date, required: true },
    checkOut: { type: Date, required: true },

    // Number of guests (validated against listing.maxGuests)
    guests: { type: Number, required: true, min: 1 },

    // Pricing breakdown (calculated server-side to prevent tampering)
    // basePricePerNight: listing.price at time of booking (frozen)
    // nights:            number of nights between checkIn and checkOut
    // subtotal:          basePricePerNight * nights
    // gst:               subtotal * 0.18 (18% GST for Indian bookings)
    // serviceFee:        subtotal * 0.05 (5% WanderLust platform fee)
    // totalAmount:       subtotal + gst + serviceFee
    basePricePerNight: { type: Number, required: true },
    nights:            { type: Number, required: true },
    subtotal:          { type: Number, required: true },
    gst:               { type: Number, required: true },
    serviceFee:        { type: Number, required: true },
    totalAmount:       { type: Number, required: true },

    // NEW FEATURE: Razorpay payment integration
    // razorpayOrderId is created on the server via Razorpay API before payment
    // razorpayPaymentId is returned by Razorpay after successful payment
    // Both are needed to verify payment authenticity server-side
    razorpayOrderId:   { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },

    // Payment status: pending → paid (after Razorpay confirmation) → refunded
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    // Booking status: pending → confirmed → cancelled
    // A confirmed booking means payment was verified successfully
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },

    // NEW FEATURE: Cancellation tracking
    // Records who cancelled, when, and why (for cancellation policy enforcement)
    cancelledAt:     { type: Date },
    cancelledBy:     { type: Schema.Types.ObjectId, ref: "User" },
    cancellationNote:{ type: String, default: "" },

    // Booking confirmation code shown to guest in receipt email
    confirmationCode: { type: String, default: "" },

    // Special requests from guest (free text shown to host)
    specialRequests: { type: String, default: "" },
  },
  { timestamps: true }
);

// VIRTUAL: durationNights — convenience getter if stored nights value is missing
bookingSchema.virtual("durationNights").get(function () {
  if (this.nights) return this.nights;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((this.checkOut - this.checkIn) / msPerDay);
});

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
