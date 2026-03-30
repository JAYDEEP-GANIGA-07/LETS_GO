// Load environment variables from .env file in non-production environments
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express      = require("express");
const app          = express();
const mongoose     = require("mongoose");
const path         = require("path");
const methodOverride = require("method-override");
const ejsMate      = require("ejs-mate");
const session      = require("express-session");
const MongoStore= require("connect-mongo").default;

const flash        = require("connect-flash");
const passport     = require("passport");
const LocalStrategy = require("passport-local");

const User    = require("./models/user.js");
const wrapAsync    = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");

// Routes
const listingRouter = require("./routes/listing.js");
const reviewRouter  = require("./routes/review.js");
const userRouter    = require("./routes/user.js");
const bookingRouter = require("./routes/booking.js"); // NEW FEATURE: booking system
const { error } = require("console");

// ─── View engine setup ────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

// ─── MongoDB connection ───────────────────────────────────────────────────────
// Uses MONGO_URL from .env in production (MongoDB Atlas) or local dev DB
// Uses ATLASDB_URL from .env in production (MongoDB Atlas), or local DB in dev
const MONGO_URL = process.env.ATLASDB_URL ;
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));


const store=MongoStore.create(
    {
        mongoUrl:process.env.ATLASDB_URL,
        crypto:{
            secret: process.env.SECRET
        },
        touchAfter: 24*3600,
    }
);

store.on("error",(error)=>{
    console.log("Error Mongo Session Store ", error);
    
})

// ─── Session configuration ────────────────────────────────────────────────────
// NEW FEATURE: SESSION_SECRET from env variable — never hard-code secrets
const sessionOptions = {
  store,
  secret:            process.env.SECRET ,
  resave:            false,
  saveUninitialized: true,
  cookie: {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxAge:  7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    // secure: true, // Uncomment in production with HTTPS
  },
};

app.use(session(sessionOptions));
app.use(flash());

// ─── Passport auth setup ──────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ─── Global template locals ───────────────────────────────────────────────────
// Makes flash messages and current user available in ALL EJS templates
app.use((req, res, next) => {
  res.locals.success  = req.flash("success");
  res.locals.error    = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/", bookingRouter); // NEW: booking routes (GET/POST /bookings, /listings/:id/book, etc.)

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ExpressError(404, "Page not found!"));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { err });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` WanderLust server running at http://localhost:${PORT}`);
});
