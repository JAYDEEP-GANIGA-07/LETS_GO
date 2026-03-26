const express=require("express");
const router= express.Router();
const Listing=require("../models/listing.js")
const wrapAsync= require("../utils/wrapAsync.js")
const ExpressError= require("../utils/ExpressError.js")
const {listingSchema }=require("../schema.js"); 
const {isLoggedIn, isOwner ,validateListing}=require("../middleware.js");

const multer =require("multer")//npm i multer
const {storage}=require("../cloudConfig.js")
const upload= multer({storage})


//Index Route


// ============================================================
// ALSO ADD THIS to your routes/listing.js for title search:
// (Optional: extends search to also match listing title)
// ============================================================

// // Extended version (city + country + title):
// router.get("/", wrapAsync(async (req, res) => {
//     const { search } = req.query;

//     let allListings;

//     if (search && search.trim() !== "") {
//         allListings = await Listing.find({
//             $or: [
//                 { location: { $regex: search, $options: "i" } },
//                 { country:  { $regex: search, $options: "i" } },
//                 { title:    { $regex: search, $options: "i" } },
//             ]
//         });
//     } else {
//         allListings = await Listing.find({});
//     }

//     res.render("listings/index.ejs", { allListings, search: search || "" });
// }));

// router.get("/", wrapAsync(async (req, res) => {
//     const { search } = req.query;
//     const page = parseInt(req.query.page) || 1; // current page, default 1
//     const limit = 12; // listings per page
//     const skip = (page - 1) * limit;

//     let filter = {};
//     if (search && search.trim() !== "") {
//         filter = {
//             $or: [
//                 { location: { $regex: search, $options: "i" } },
//                 { country:  { $regex: search, $options: "i" } },
//                 { title:    { $regex: search, $options: "i" } },
//             ]
//         };
//     }

//     const totalListings = await Listing.countDocuments(filter);
//     const totalPages = Math.ceil(totalListings / limit);
//     const allListings = await Listing.find(filter).skip(skip).limit(limit);

//     res.render("listings/index.ejs", { 
//         allListings, 
//         search: search || "",
//         currentPage: page,
//         totalPages,
//         totalListings
//     });
// }));


// Index Route — Search + Category Filter + Pagination
router.get("/", wrapAsync(async (req, res) => {
    const { search, category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    let filter = {};

    if (category && category.trim() !== "") {
        filter.category = category;
    }

    if (search && search.trim() !== "") {
        filter.$or = [
            { location: { $regex: search, $options: "i" } },
            { country:  { $regex: search, $options: "i" } },
            { title:    { $regex: search, $options: "i" } },
        ];
    }

    const totalListings = await Listing.countDocuments(filter);
    const totalPages = Math.ceil(totalListings / limit);
    const allListings = await Listing.find(filter).skip(skip).limit(limit);

    res.render("listings/index.ejs", {
        allListings,
        search: search || "",
        category: category || "",
        currentPage: page,
        totalPages,
        totalListings
    });
}));







//Index Route 
// router.get("/",wrapAsync(async(req,res)=>{
// const allListings= await Listing.find({});
// res.render("listings/index.ejs",{allListings});
// }))

//New Route 
router.get("/new",isLoggedIn,(req,res)=>{//isLoggedIn is in middleware.js
    console.log(req.user);//will be undefined is user is not logged in , bydefault stores essential user data
    res.render("listings/new.ejs");
})
//Create Route 
router.post("/",isLoggedIn,upload.single("listing[image]"),validateListing
    ,wrapAsync(async(req,res,next)=>{
//  let {title,description, image,price, location , country}= req.body; instead use the below for easier access by
//  let listing= req.body.listing;//to extract easily
//apply all warpAsync
console.log("Create Block");
let url = req.file.path
let filename = req.file.filename
console.log(url);
console.log(filename);


const newListing =new Listing(req.body.listing);
newListing.owner=req.user._id;//req.user constains all the user data given by passport 
console.log(req.user._id);

newListing.image={url,filename}

 await newListing.save();
 console.log(newListing);
 
 req.flash("success","New listing created!")
 res.redirect("/listings");

}))


//Show Route if show route is kept above the new route this will give an error as the new route consider the /new as an id
router.get("/:id",wrapAsync(async(req,res)=>{
 let {id}= req.params;
 const listing= await Listing.findById(id).populate({path:"reviews",populate:{path:"author"}}).populate("owner");

 if (!listing) {
     req.flash("error","Listing You Requested for , does not exist!")
    return   res.redirect("/listings")
 }
//  console.log(listing);
 
 res.render("listings/show.ejs",{listing})
}))

//Edit Route 
router.get("/:id/edit",isLoggedIn,isOwner,wrapAsync(async(req,res)=>{
 let {id}= req.params;
 const listing= await Listing.findById(id);

  if (!listing) {
     req.flash("error","Listing You Requested for , does not exist!")
    return  res.redirect("/listings")
 }

 let originalImageUrl=listing.image.url;
 originalImageUrl= originalImageUrl.replace("/upload","/upload/h_200")

 res.render("listings/edit.ejs",{listing , originalImageUrl})
}))
//Update Route 
router.put("/:id",isLoggedIn,isOwner,upload.single("listing[image]"),validateListing
    ,wrapAsync(async(req,res)=>{
 let {id}= req.params;

 let listing= await Listing.findByIdAndUpdate(id,{...req.body.listing});

 if (typeof req.file!=="undefined") {//if there is any change in the edited image then only this will work
  let url = req.file.path
let filename = req.file.filename
listing.image={url,filename}
await listing.save();

 }

 req.flash("success","Listing Updated!")
 res.redirect(`/listings/${id}`)
}))


//Destroy Route 
router.delete("/:id",isLoggedIn,isOwner,wrapAsync(async(req,res)=>{
 let {id}= req.params;
 const deletedList =  await Listing.findByIdAndDelete(id);//when this will called themongoose middleware will get called in listing.js
  console.log(deletedList);
   req.flash("success","Listing Deleted!")
 res.redirect('/listings')
}))




module.exports=router;