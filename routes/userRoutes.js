import express from "express";
import { getCars, getUserData, loginUser, registerUser, googleAuth } from "../controllers/userControllers.js";
import {protect} from "../middleware/auth.js";

const userRouter = express.Router();

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.post('/google-auth', googleAuth)
userRouter.get('/data', protect, getUserData)
userRouter.get('/cars', getCars)

export default userRouter;