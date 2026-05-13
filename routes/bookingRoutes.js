import express from "express";
import { changeBookingsStatus, checkAvailabilityOfCar, createBooking, getOwnerBookings, getUserBookings } from "../controllers/bookingControllers.js";
import { protect} from "../middleware/auth.js";

const bookingRouter = express.Router();

bookingRouter.post('/check-availability', checkAvailabilityOfCar)
bookingRouter.post('/create', protect, createBooking)
bookingRouter.post('/user', protect, getUserBookings)
bookingRouter.post('/owner', protect, getOwnerBookings)
bookingRouter.post('/change-status', protect, changeBookingsStatus)

export default bookingRouter;