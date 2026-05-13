import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types

const carSchema = new mongoose.Schema({
    owner:{
        type:ObjectId,
        ref:'user'
    },
    brand:{
        type:String,
        require: true
    },
    model:{
        type:String,
        require: true
    },
    image:{
        type:String,
        require: true
    },
    year:{
        type:Number,
        require: true
    },
    category:{
        type:String,
        require: true
    },
    seating_capacity:{
        type:Number,
        require: true
    },
    fuel_type:{
        type:String,
        require: true
    },
    transmission:{
        type:String,
        require: true
    },
    pricePerDay:{
        type:Number,
        require: true
    },
    location:{
        type:String,
        require: true
    },
    description:{
        type:String,
        require: true
    },
    isAvaliable:{
        type:Boolean,
        require: true
    }
},{timestamps:true})

const Car = mongoose.model('Car', carSchema)

export default Car;