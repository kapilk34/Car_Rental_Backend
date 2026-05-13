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

//Get yser data using token(jwt)
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