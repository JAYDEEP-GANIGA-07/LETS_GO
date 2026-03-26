const mongoose= require("mongoose");
const initData=require("./data.js")
const Listing= require("../models/listing.js");

main()
.then(()=>{
console.log("connection to DB successful");

})
.catch((err)=>{console.log(err)});

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/wanderlust');
}

const initDB = async ()=>{
    await Listing.deleteMany({});
initData.data=initData.data.map((obj)=>({...obj,owner:"699ea39f90337ebb637389e4"}))
console.log(initData.data);

    await Listing.insertMany(initData.data);
    console.log("Data was Initialized");
    
}

initDB();