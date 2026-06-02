import User from "../models/user.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import Car from "../models/car.js";

//Generate Jwt Token
const generateToken = (userId) => {
    const payload = userId;
    return jwt.sign(payload, process.env.JWT_SECRET)
}

//Register User
export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body
        if (!name || !email || !password || password.length < 8) {
            return res.json({ success: false, message: `All fields are require and passward lenth should be greater that 8` })
        }
        const userExists = await User.findOne({ email })
        if (userExists) {
            return res.json({ success: false, message: `User already exist` })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await User.create({ name, email, password: hashedPassword })
        const token = generateToken(user._id.toString())
        res.json({success:true, token})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}


//login User
export const loginUser = async (req, res) =>{
    try{
        const {email, password} = req.body
        const user = await User.findOne({email})
        if(!user){
            return res.json({success:false, message:"user not found"})
        }
        const isMatch = await bcrypt.compare(password, user.password)
        if(!isMatch){
            return res.json({success:false, message:"Invalid Credentials"})
        }
        const token = generateToken(user._id.toString())
        res.json({success:true, token})

    } catch (error){
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

//Get your data using token(jwt)
export const getUserData = async(req, res) =>{
    try{
        const {user} = req;
        res.json({success: true, user})
    }catch (error){
        console.log(error.message);
        res.json({success: false, message: error. message})
    }
}


//Get all cars for the Frontend
export const getCars = async (req, res)=>{
    try {
        const cars = await Car.find({isAvaliable: true})
        res.json({success: true, cars})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
        
    }
}

// Google Auth User
export const googleAuth = async (req, res) => {
    try {
        const { email, name, image } = req.body;
        
        if (!email || !name) {
            return res.json({ success: false, message: "Email and name are required from Google Auth" });
        }

        // Check if user already exists
        let user = await User.findOne({ email });

        if (user) {
            // User exists, just log them in
            const token = generateToken(user._id.toString());
            return res.json({ success: true, token, message: "Logged in successfully with Google" });
        } else {
            // User does not exist, create a new one
            // Generate a secure random password since they won't use it to login
            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await User.create({ 
                name, 
                email, 
                password: hashedPassword,
                image: image || '' 
            });

            const token = generateToken(user._id.toString());
            return res.json({ success: true, token, message: "Account created successfully with Google" });
        }

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}