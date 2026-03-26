if (process.env.NODE_ENV !="production") {
require('dotenv').config() // or import 'dotenv/config' if you're using ES6    
}

// console.log(process.env.SECRET) // remove this after you've confirmed it is working

const express= require("express");
const app =express();
const mongoose =require("mongoose");
const Listing=require("./models/listing.js")
const path=require("path");
const methodOverride= require("method-override");
const ejsMate= require("ejs-mate");
const wrapAsync= require("./utils/wrapAsync.js")
const ExpressError= require("./utils/ExpressError.js")

const session=require("express-session")
const MongoStore =require('connect-mongo').default;

const flash=require("connect-flash")
const {listingSchema ,reviewSchema}=require("./schema.js");   
const Review=require("./models/review.js")
const passport=require("passport")
const LocalStrategy=require("passport-local")
const User=require("./models/user.js")

//routes
const listingRouter=require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");


 
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));//middleware//work done after getting a request and before giving a reposnse 
//they can access and make changes req and res objects 
//end the req-res cycle
// chaining of middleware functions is possible 
//execute any code 
app.use(methodOverride("_method"));//middleware
app.engine('ejs',ejsMate);
app.use(express.static(path.join(__dirname,"/public")))//middleware
app.use(express.json())

const dbUrl=process.env.ATLASDB_URL;
main()
.then(()=>{
console.log("connection to DB successful");

})
.catch((err)=>{console.log(err)});

async function main() {
    // await mongoose.connect('mongodb://127.0.0.1:27017/wanderlust');
    await mongoose.connect(dbUrl);



}


    
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



const sessionOptions={
    store,
    secret: process.env.SECRET,//in env file 
    resave:false,
    saveUninitialized:true,
    cookie:{
        // expires:Date.now()*7*24*60*60*1000,
        expires: new Date(Date.now() + 7*24*60*60*1000),
        maxAge:7*24*60*60*1000,
        httpOnly:true//search cross scripting attacks
    },
};


app.use(session(sessionOptions))
app.use(flash());




//to implement passport we need sessions
app.use(passport.initialize());//middleware 
app.use(passport.session());//middleware 
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());//to store the data in session
passport.deserializeUser(User.deserializeUser());//to remove stored the data in session



app.use((req,res,next)=>{
    res.locals.success=req.flash("success");
    res.locals.error=req.flash("error");
    res.locals.currUser=req.user;//we made a local variable so that it can be used in navbar.ejs contains req.user
    next();
})


// app.get("/demouser",async(req,res)=>{
// let fakeUser= new User({
//     email:"jayjay@gmail.com",
//     username:"SigmaSigma"//passport-local-mongoose automatically made username in User schema
// })

// let  regsiteredUser= await User.register(fakeUser,'Sigma1234')
// res.send(regsiteredUser)
// })


// app.get("/testListing",async(req,res)=>{
//     let samplelisting=new Listing({
//         title: "My new Villa",
//         description: "Ekdum Mast for Holidays",
//         price: 2000,
//         location: "Pune",
//         country: "India",
//     })
//    await samplelisting.save();
// // await Listing.findByIdAndDelete('695fc9096b38d09e286510e2');
//     console.log("Sample data saved>_<");
//     res.send("Successful Data saved");
    
// })


// //Validate serverside for listing using middleware
// const validateListing=(req,res,next)=>{
    
// let {error}=listingSchema.validate(req.body);//from schema.js it checks and validates if all the constaints that are defined in it are satisfying
// console.log(error);


//     // console.log("Validated Result:",result);//try sending incomplete form data from postman api
// if (error) {
//    let errMsg=error.details.map((el)=>el.message).join(",")
//     console.log(errMsg);
//     console.log("hello error");
//      throw new ExpressError(400,errMsg)   
// }else{
//     console.log("hello");
//     next();
// }
// }

//Validate serverside for reviews using middleware


// const validateReview=(req,res,next)=>{
    
// let {error}=reviewSchema.validate(req.body);//from schema.js it checks and validates if all the constaints that are defined in it are satisfying
// console.log("Before error");

// console.log(error);

// console.log("AFTER error");



//     // console.log("Validated Result:",result);//try sending incomplete form data from postman api
// if (error) {
//    let errMsg=error.details.map((el)=>el.message).join(",")
//     console.log(errMsg);
//      throw new ExpressError(400,errMsg)   
// }else{
//     next();
// }
// }




app.use("/listings",listingRouter);//required listing routes from Folder routes
app.use("/listings/:id/reviews",reviewRouter);//required review routes from Folder routes
app.use("/",userRouter);//required user routes from Folder routes




// //Index Route 
// app.get("/listings",wrapAsync(async(req,res)=>{
// const allListings= await Listing.find({});
// res.render("listings/index.ejs",{allListings});
// }))

// //New Route 
// app.get("/listings/new",wrapAsync(async(req,res)=>{
//  res.render("listings/new.ejs")
// }))
// //Create Route 
// app.post("/listings",validateListing
//     ,wrapAsync(async(req,res,next)=>{
// //  let {title,description, image,price, location , country}= req.body; instead use the below for easier access by
// //  let listing= req.body.listing;//to extract easily
// //apply all warpAsync
// console.log("here");

// const newListing =new Listing(req.body.listing);
//  await newListing.save();
//  console.log(newListing);
 
//  res.redirect("/listings");

// }))


// //Show Route if show route is kept above the new route this will give an error as the new route consider the /new as an id
// app.get("/listings/:id",wrapAsync(async(req,res)=>{
//  let {id}= req.params;
//  const listing= await Listing.findById(id).populate("reviews");
//  res.render("listings/show.ejs",{listing})
// }))

// //Edit Route 
// app.get("/listings/:id/edit",wrapAsync(async(req,res)=>{
//  let {id}= req.params;
//  const listing= await Listing.findById(id);
//  res.render("listings/edit.ejs",{listing})
// }))
// //Update Route 
// app.put("/listings/:id",validateListing
//     ,wrapAsync(async(req,res)=>{
//  let {id}= req.params;
//   await Listing.findByIdAndUpdate(id,{...req.body.listing});
//  res.redirect(`/listings/${id}`)
// }))


// //Destroy Route 
// app.delete("/listings/:id",wrapAsync(async(req,res)=>{
//  let {id}= req.params;
//  const deletedList =  await Listing.findByIdAndDelete(id);//when this will called themongoose middleware will get called in listing.js
//   console.log(deletedList);
//  res.redirect('/listings')
// }))




//Reviews route

// app.post("/listings/:id/reviews",validateReview,wrapAsync(async(req,res)=>{
//   let listing=await Listing.findById(req.params.id)
//   let newReview= new Review(req.body.review)

//   listing.reviews.push(newReview);

//   await newReview.save();
//   await listing.save();

//   console.log("New review saved");
//  res.redirect(`/listings/${listing._id}`)
  
// }))
// // Delete Review route
// app.delete("/listings/:id/reviews/:reviewId",wrapAsync(async(req,res)=>{
// // Mongo $pull operator removes from an existing array all instances of a value or values that match apecified condition
// let {id,reviewId}=req.params;
// await Listing.findByIdAndUpdate(id, {$pull:{reviews:reviewId}});
// await Review.findByIdAndDelete(reviewId)

//  res.redirect(`/listings/${id}`)
  
// }))

console.log


app.use((req,res,next)=>{
next(new ExpressError(404,"Page not found Man!"));
})

app.use((err,req,res,next)=>{
    let {statusCode=500 ,message="Something went wrong !"}=err;
// res.status(statusCode).send(message);
res.status(statusCode).render("error.ejs",{err});//http://localhost:3000/listings/abcs
//http://localhost:3000/donotexist
})


app.listen("3000", ()=>{
    console.log("Listening at Port: 3000");
    
})
