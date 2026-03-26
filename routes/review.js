const express = require("express");
const router= express.Router({mergeParams:true});

const wrapAsync= require("../utils/wrapAsync.js")
const ExpressError= require("../utils/ExpressError.js")
const { reviewSchema}=require("../schema.js");   
const Review=require("../models/review.js")
const Listing=require("../models/listing.js")
const {validateReview, isLoggedIn, isReviewAuthor}=require("../middleware.js")



//Reviews route

router.post("/",isLoggedIn,validateReview,wrapAsync(async(req,res)=>{

    console.log(req.params.id);//using mergeparams in router allows the :id to be passed from the app.js 
    
  let listing=await Listing.findById(req.params.id)
  let newReview= new Review(req.body.review)

  newReview.author=req.user._id;
console.log(newReview);


  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();

  console.log("New review saved");

   req.flash("success","New Review created!")
 res.redirect(`/listings/${listing._id}`)
  
}))
// Delete Review route
router.delete("/:reviewId",isLoggedIn,isReviewAuthor,wrapAsync(async(req,res)=>{
// Mongo $pull operator removes from an existing array all instances of a value or values that match apecified condition
let {id,reviewId}=req.params;
await Listing.findByIdAndUpdate(id, {$pull:{reviews:reviewId}});
await Review.findByIdAndDelete(reviewId)
   req.flash("success","Review Deleted!")
 res.redirect(`/listings/${id}`)
  
}))


module.exports=router;


