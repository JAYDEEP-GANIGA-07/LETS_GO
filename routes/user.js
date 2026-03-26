const express=require("express");
const router= express.Router();
const User= require("../models/user.js")
const wrapAsync=require("../utils/wrapAsync.js")
const passport=require("passport");
const { saveRedirectUrl } = require("../middleware.js");

const Listing= require("../models/listing.js")

router.get("/signup",(req,res)=>{
    res.render("users/signup.ejs")
})

router.post("/signup",wrapAsync(async(req,res, next)=>{
    try{
let {username,email,password}=req.body;
const newUser = new User({email,username});
const registeredUser= await User.register(newUser,password);
console.log(registeredUser);

req.login(registeredUser,(err)=>{//automatic login after sign up no need for the use rto put login page deatils again
  if (err) {
    return next(err)
  }
  req.flash("success","Welcome to the webiste")
 res.redirect("/listings")
})


    }
    catch(e){
        console.log(e);
        req.flash("error",e.message)
        res.redirect("/signup")
        
    }
}));

router.get("/login",(req,res)=>{
     res.render("users/login.ejs")
})

router.post("/login",saveRedirectUrl,passport.authenticate("local",{failureRedirect:"/login",failureFlash:true}),
 async(req,res)=>{//the function is middleware check on npmjs passport
    req.flash("success","Welcome Back to wanderLust")
    let redirectUrl=res.locals.redirectUrl || "/listings"
    res.redirect(redirectUrl)
})

router.get("/logout",(req,res,next)=>{
   req.logout((err)=>{//read docs of passportjs.org
    if (err) {
      return next(err);
    }
     req.flash("success","You are Logged out")
      res.redirect("/listings")
   });

})


//userprofile
// Profile Route
router.get("/profile/:username", wrapAsync(async (req, res) => {
    const { username } = req.params;

    const profileUser = await User.findOne({ username });
    if (!profileUser) {
        req.flash("error", "User not found!");
        return res.redirect("/listings");
    }

    const userListings = await Listing.find({ owner: profileUser._id });

    const listingsWithReviews = await Listing.find({ owner: profileUser._id }).populate("reviews");
    let totalReviews = 0;
    let ratingSum = 0;

    for (let listing of listingsWithReviews) {
        totalReviews += listing.reviews.length;
        for (let review of listing.reviews) {
            ratingSum += review.rating;
        }
    }

    const avgRating = totalReviews > 0 ? (ratingSum / totalReviews).toFixed(1) : 0;

    res.render("users/profile.ejs", { profileUser, userListings, totalReviews, avgRating });
}));


module.exports=router;