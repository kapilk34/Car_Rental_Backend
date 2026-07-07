import User from "../models/user.js";
import Car from "../models/car.js";
import fs from "fs";
import imagekit from "../configs/imageKit.js";
import { error } from "console";
import Booking from "../models/booking.js";

export const changeRoleToOwner = async (req, res) => {
    try {
        const { _id } = req.user;
        await User.findByIdAndUpdate(_id, { role: "owner" })
        res.json({ success: true, message: "Now you can list cars" })
    } catch (error) {
        console.log(error.message);
        res.json({ sucess: false, message: error.message })
    }
}

//API to list car
export const addCar = async (req, res) => {
    try {
        const { _id } = req.user;
        let car = JSON.parse(req.body.carData);
        const imageFile = req.file;

        if (!imageFile) {
            return res.json({ success: false, message: "Image is required" });
        }

        //upload image to imagekit
        const fileBuffer = fs.readFileSync(imageFile.path)
        const response = await imagekit.upload({
            file: fileBuffer,
            fileName: imageFile.originalname,
            folder: '/cars'
        })

        // Delete temporary file
        try {
            fs.unlinkSync(imageFile.path);
        } catch (unlinkError) {
            console.log("Error deleting temp file:", unlinkError);
        }

        var optimizedimageURL = imagekit.url({
            path: response.filePath,
            transformation: [
                {width:'1280'},
                {quality:'auto'},
                {format:'webp'}
            ]
        });

        const image = optimizedimageURL;
        await Car.create({...car, owner: _id, image, isAvaliable: true})

        res.json({success: true, message: "Car Added"})

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// API to list owner cars
export const getOwnerCars = async (req, res)=>{
    try {
       const { _id } = req.user; 
       const cars = await Car.find({owner: _id})
       res.json({success: true, cars})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

//API to toggle car availability
export const toggleCarAvailability = async (req, res)=>{
    try {
       const { _id } = req.user; 
       const {carId} = req.body
       const car = await Car.findById(carId)

       //checking the cards belong to the user 
       if(car.owner.toString() !== _id.toString()){
        return res.json ({success: false, message:"Unauthorized"});
       }

       car.isAvaliable = !car.isAvaliable;
       await car.save()
       
       res.json({success: true, message: "Avalibility Toggled"})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}


// API to update car details and/or image
export const updateCar = async (req, res) => {
    try {
        const { _id } = req.user;
        const { carId, carData } = req.body;
        const car = await Car.findById(carId);

        if (!car) return res.json({ success: false, message: "Car not found" });
        if (car.owner.toString() !== _id.toString())
            return res.json({ success: false, message: "Unauthorized" });

        const updates = carData ? JSON.parse(carData) : {};

        if (req.file) {
            const fileBuffer = fs.readFileSync(req.file.path);
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: req.file.originalname,
                folder: '/cars'
            });
            try { fs.unlinkSync(req.file.path); } catch (e) { console.log(e); }
            updates.image = imagekit.url({
                path: response.filePath,
                transformation: [{ width: '1280' }, { quality: 'auto' }, { format: 'webp' }]
            });
        }

        await Car.findByIdAndUpdate(carId, updates);
        res.json({ success: true, message: "Car updated successfully" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

//API to delete a car
export const deleteCar = async (req, res)=>{
    try {
       const { _id } = req.user; 
       const {carId} = req.body
       const car = await Car.findById(carId)

       //checking the cards belong to the user 
       if(car.owner.toString() !== _id.toString()){
        return res.json ({success: false, message:"Unauthorized"});
       }

       car.owner = null;
       car.isAvaliable = false;

       await car.save()
       
       res.json({success: true, message: "Car removed"})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}


//API to get Dashboard Data
export const getDashboardData  = async (req, res)=>{
    try{
        const {_id, role} = req.user;

        if(role !== "owner"){
            return res.json({success: false, message: "Unauthorized"})
        }

        const cars = await Car.find({owner: _id}); 
        const bookings = await Booking.find({owner: _id}).populate('car').sort({createdAt: -1});

        const pendingBookings = await Booking.find({owner: _id, status:"pending"})
        const completedBookings = await Booking.find({owner: _id, status:"confirmed"})

        //calculate monthly revenue for booking where status is confirmed
        const monthlyRevenue = bookings.slice().filter(booking =>booking.status === 'confirmed').reduce((acc,booking) => acc + booking.price, 0)

        const dashboardData = {
            totalCar: cars.length,
            totalBookings: bookings.length,
            pendingBookings: pendingBookings.length,
            completedBookings: completedBookings.length,
            recentBookings : bookings.slice(0,3),
            monthlyRevenue
        }

        res.json({ success: true, dashboardData});
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}


//API  to update user image
export const updateUserImage = async (req, res)=>{
    try {
        const { _id } = req.user;
        const imageFile = req.file;

        if (!imageFile) {
            return res.json({ success: false, message: "Image is required" });
        }

        //Upload Image to ImageKit
        const fileBuffer = fs.readFileSync(imageFile.path)
        const response = await imagekit.upload({
            file: fileBuffer,
            fileName: imageFile.originalname,
            folder: '/users'
        })

        // Delete temporary file
        try {
            fs.unlinkSync(imageFile.path);
        } catch (unlinkError) {
            console.log("Error deleting temp file:", unlinkError);
        }

        //optimization through imageKit URL transformation
        var optimizedimageURL = imagekit.url({
            path: response.filePath,
            transformation: [
                {width: '400'},
                {quality:'auto'},
                {format:'webp'}
            ] 
        });

        const image = optimizedimageURL;

        await User.findByIdAndUpdate(_id, {image});
        res.json({success: true, message: "Image Updated"})
        
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})   
    }
}