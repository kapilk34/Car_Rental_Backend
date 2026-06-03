import express from "express";
import "dotenv/config"
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./configs/db.js";
import userRouter from "./routes/userRoutes.js";
import ownerRouter from "./routes/ownerRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import { initializeSocketHandlers } from "./socket/bookingSocketHandlers.js";

//Initialize Express App
const app = express()
const server = http.createServer(app);

//Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true,
        methods: ["GET", "POST"]
    }
});

//Connecting Database
await connectDB()

//Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(express.json());

//Make io accessible to routes
app.set('io', io);

app.get('/', (req,res)=> res.send("Server is running"))
app.use('/api/user', userRouter )
app.use('/api/owner', ownerRouter)
app.use('/api/bookings', bookingRouter)

//Initialize Socket Handlers
initializeSocketHandlers(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT,()=> {
    console.log(`Server running on the port ${PORT}`)
})