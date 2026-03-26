const mongoose= require("mongoose");
const Schema= mongoose.Schema;
const Review= require("./review.js")

const listingSchema= new Schema({
    title:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    // image:{
    //     type:String,
    //     default:"https://images.unsplash.com/photo-1602391833977-358a52198938?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzJ8fGNhbXBpbmd8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60",
    //     set:(v)=>v=== ""?"https://images.unsplash.com/photo-1602391833977-358a52198938?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzJ8fGNhbXBpbmd8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60":v,
    // },
    image:{
        url:String,
        filename:String,
    },
    price:{
        type:Number,
        required:true,
    },
    location:{
        type:String,
        required:true,
    },
    country:{
        type:String,
        required:true,
    },
    reviews:[
        {
            type:Schema.Types.ObjectId,
            ref:"Review",
        },
    ],
    owner:  {
            type:Schema.Types.ObjectId,
            ref:"User",
        },
      category:{
        type:String,
        enum:["trending","rooms","iconic city","mountains","castles","amazing pools","camping","farms","arctic","domes","ports"],
        default:"trending"
    } ,
    geometry: {
    type: {
        type: String,
        enum: ["Point"],
        default: "Point"
    },
    coordinates: {
        type: [Number], // [longitude, latitude]
    }
}, 
    
});

//mongoose middleware to delete the reviews when the posted listing is deleted
listingSchema.post("findOneAndDelete",async(listing)=>{
    if (listing) {
         await Review.deleteMany({_id :{$in:listing.reviews}}) 
    }
  
})

const Listing= mongoose.model("Listing", listingSchema);
module.exports=Listing;