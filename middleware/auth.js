import jwt from "jsonwebtoken";
import User from "../models/user.js"; 

export const protect = async (req, res, next)=>{
    let token = req.headers.authorization;
    
    if(!token){
        return res.json({success:false, message: "not authorized"})
    }

    // Extract token from "Bearer <token>" format if present
    if(token.startsWith('Bearer ')){
        token = token.slice(7);
    }

    try{
        const userId = jwt.verify(token, process.env.JWT_SECRET)

        if(!userId){
            return res.json({success:false, message: "not authorized"})
        }
        req.user = await User.findById(userId).select("-password")
        next();
    } catch (error){
        return res.json({success:false, message: "not authorized"})
    }
}