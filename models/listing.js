const mongoose = require("mongoose");
const reviews = require("./review");
const Schema = mongoose.Schema;
const Review = require("./review.js");

// ─────────────────────────────────────────────────────────────────────────────
// NEW FEATURE: images[] array supports multiple Cloudinary photos per listing
//              (Previously only one image was stored — now up to 10 are allowed)
// ─────────────────────────────────────────────────────────────────────────────
const listingSchema = new Schema(
  {
    title: { type: String, required: true },

    // NEW FEATURE: Structured description sections (like Airbnb)
    // Previously a single textarea — now split into meaningful sections
    description: {
      aboutSpace:  { type: String, default: "" },
      theSpace:    { type: String, default: "" },
      guestAccess: { type: String, default: "" },
      neighborhood:{ type: String, default: "" },
      otherThings: { type: String, default: "" },
    },

    // NEW FEATURE: Multiple images array
    // Replaces single {url,filename} — now an array so hosts can upload 5+ photos
    images: [{ url: String, filename: String }],

    // Keep old single image field for backward compat with existing DB docs
    image: {
      url:      { type: String, default: "" },
      filename: { type: String, default: "" },
    },

    price:    { type: Number, required: true },
    location: { type: String, required: true },
    country:  { type: String, required: true },

    // NEW FEATURE: Property capacity fields
    // Every real rental platform shows guests/beds/bedrooms/bathrooms
    maxGuests: { type: Number, default: 1, min: 1 },
    bedrooms:  { type: Number, default: 1, min: 0 },
    beds:      { type: Number, default: 1, min: 1 },
    bathrooms: { type: Number, default: 1, min: 0 },

    // NEW FEATURE: Category filter — enables the category pills to actually
    // filter listings from the DB (previously they were decorative icons only)
    category: {
      type: String,
      enum: ["trending","rooms","iconic-city","mountains","castles","pools",
             "camping","farms","arctic","domes","boats","beach","desert","luxury"],
      default: "trending",
    },

    // NEW FEATURE: Amenities checklist (15 most critical ones)
    // Without this guests cannot decide if the property suits their needs
    amenities: [{
      type: String,
      enum: ["wifi","ac","kitchen","parking","pool","tv","washing-machine",
             "gym","pet-friendly","smoke-alarm","first-aid","fire-extinguisher",
             "workspace","hot-tub","bbq"],
    }],

    // NEW FEATURE: House Rules
    // Legally required operational information for any rental platform
    houseRules: {
      checkInTime:   { type: String,  default: "15:00" },
      checkOutTime:  { type: String,  default: "11:00" },
      smokingAllowed:{ type: Boolean, default: false   },
      petsAllowed:   { type: Boolean, default: false   },
      partiesAllowed:{ type: Boolean, default: false   },
    },

    // NEW FEATURE: Cancellation policy
    // A company cannot use a platform with no cancellation terms — legal requirement
    cancellationPolicy: {
      type: String,
      enum: ["flexible","moderate","strict"],
      default: "moderate",
    },

    // NEW FEATURE: Wishlist tracking
    // Stores user IDs who saved this listing — used to render filled/unfilled heart
    savedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // NEW FEATURE: Report/flag tracking
    // Stores user IDs who reported listing as inappropriate/fake
    reportedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],

    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
    owner:   { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// VIRTUAL: avgRating — computes average rating from populated reviews[]
// Used on index cards to show star ratings without an extra DB query
listingSchema.virtual("avgRating").get(function () {
  if (!this.reviews || this.reviews.length === 0) return 0;
  const populated = this.reviews.filter((r) => r && typeof r === "object" && r.rating);
  if (populated.length === 0) return 0;
  const sum = populated.reduce((acc, r) => acc + r.rating, 0);
  return (sum / populated.length).toFixed(1);
});

// VIRTUAL: primaryImage — returns first image URL from images[] array,
// falls back to legacy single image.url, then a placeholder
listingSchema.virtual("primaryImage").get(function () {
  if (this.images && this.images.length > 0 && this.images[0].url) return this.images[0].url;
  if (this.image && this.image.url) return this.image.url;
  return "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800";
});

listingSchema.set("toJSON",   { virtuals: true });
listingSchema.set("toObject", { virtuals: true });

// MONGOOSE MIDDLEWARE: cascade-delete reviews when listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) await Review.deleteMany({ _id: { $in: listing.reviews } });
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
