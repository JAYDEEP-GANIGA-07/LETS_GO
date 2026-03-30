// ─────────────────────────────────────────────────────────────────────────────
// Joi server-side validation schemas
// These validate req.body BEFORE touching the DB, giving clear error messages
// to the client without depending on Mongoose's own validation errors.
// ─────────────────────────────────────────────────────────────────────────────
const Joi = require("joi");

// NEW FEATURE: Updated listingSchema now validates all new fields:
// amenities, category, capacity fields, houseRules, cancellationPolicy,
// and the new structured description sub-object
module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title:       Joi.string().required(),

    // NEW: structured description sections (all optional strings)
    description: Joi.object({
      aboutSpace:   Joi.string().allow("", null),
      theSpace:     Joi.string().allow("", null),
      guestAccess:  Joi.string().allow("", null),
      neighborhood: Joi.string().allow("", null),
      otherThings:  Joi.string().allow("", null),
    }).required(),

    price:    Joi.number().required().min(0),
    location: Joi.string().required(),
    country:  Joi.string().required(),

    // NEW: capacity fields
    maxGuests: Joi.number().min(1).default(1),
    bedrooms:  Joi.number().min(0).default(1),
    beds:      Joi.number().min(1).default(1),
    bathrooms: Joi.number().min(0).default(1),

    // NEW: category for filtering
    category: Joi.string()
      .valid("trending","rooms","iconic-city","mountains","castles","pools",
             "camping","farms","arctic","domes","boats","beach","desert","luxury")
      .default("trending"),

    // NEW: amenities array
    amenities: Joi.array().items(Joi.string()).default([]),

    // NEW: house rules
    houseRules: Joi.object({
      checkInTime:    Joi.string().default("15:00"),
      checkOutTime:   Joi.string().default("11:00"),
      smokingAllowed: Joi.boolean().default(false),
      petsAllowed:    Joi.boolean().default(false),
      partiesAllowed: Joi.boolean().default(false),
    }).default(),

    // NEW: cancellation policy
    cancellationPolicy: Joi.string()
      .valid("flexible","moderate","strict")
      .default("moderate"),

    // image field is now optional (handled via multer file upload)
    image: Joi.string().allow("", null),
  }).required(),
}).required();

// reviewSchema validates the star rating and comment before saving to DB
module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating:  Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
}).required();

// NEW: bookingSchema validates booking form data server-side
// Prevents guests from manipulating dates or guest counts via Postman
module.exports.bookingSchema = Joi.object({
  booking: Joi.object({
    checkIn:         Joi.date().required().min("now"),
    checkOut:        Joi.date().required().greater(Joi.ref("checkIn")),
    guests:          Joi.number().required().min(1),
    specialRequests: Joi.string().allow("", null),
  }).required(),
}).required();
