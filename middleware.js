const Listing=require("./models/listing.js")
const Review=require("./models/review.js")
const ExpressError= require("./utils/ExpressError.js")
const {listingSchema,reviewSchema}=require("./schema.js")


module.exports.isLoggedIn=(req,res ,next)=>{
        if(!req.isAuthenticated()){//checks if the user has logged in 
            req.session.redirectUrl=req.originalUrl;
   req.flash("error","You Must be Logged in to Add a Listing")
    return  res.redirect("/login")
    }
    next();
}


module.exports.saveRedirectUrl=(req,res,next)=>{
    if (req.session.redirectUrl) {
        res.locals.redirectUrl=req.session.redirectUrl;
    }
    next();
}



module.exports.isOwner=async(req,res,next)=>{
    let {id}= req.params;
  let listing= await Listing.findById(id);
  if (!listing.owner.equals(res.locals.currUser._id)) {
    req.flash("error","You are not the owner of the listing!")
   return res.redirect(`/listings/${id}`)
  }
    next();
}

//Validate serverside for listing using middleware
module.exports.validateListing=(req,res,next)=>{
    
let {error}=listingSchema.validate(req.body);//from schema.js it checks and validates if all the constaints that are defined in it are satisfying
console.log(error);


    // console.log("Validated Result:",result);//try sending incomplete form data from postman api
if (error) {
   let errMsg=error.details.map((el)=>el.message).join(",")
    console.log(errMsg);
    console.log("hello error");
     throw new ExpressError(400,errMsg)   
}else{
    console.log("hello");
    next();
}
}



module.exports.validateReview=(req,res,next)=>{  
let {error}=reviewSchema.validate(req.body);//from schema.js it checks and validates if all the constaints that are defined in it are satisfying
console.log("Before error");
console.log(error);
console.log("AFTER error");

    // console.log("Validated Result:",result);//try sending incomplete form data from postman api
if (error) {
   let errMsg=error.details.map((el)=>el.message).join(",")
    console.log(errMsg);
     throw new ExpressError(400,errMsg)   
}else{
    next();
}
}


module.exports.isReviewAuthor=async(req,res,next)=>{
    let {id,reviewId}= req.params;
  let review= await Review.findById(reviewId);
  if (!review.author.equals(res.locals.currUser._id)) {
    req.flash("error","You Did NOT Created This Review!")
   return res.redirect(`/listings/${id}`)
  }
    next();
}
