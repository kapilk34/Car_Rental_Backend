import express from "express";
import { changeBookingsStatus, checkAvailabilityOfCar, createBooking, getOwnerBookings, getUserBookings, createPaymentIntent, confirmPayment } from "../controllers/bookingControllers.js";
import { protect} from "../middleware/auth.js";

const bookingRouter = express.Router();

bookingRouter.post('/check-availability', checkAvailabilityOfCar)
bookingRouter.post('/create', protect, createBooking)
bookingRouter.post('/create-payment-intent', protect, createPaymentIntent)
bookingRouter.post('/confirm-payment', protect, confirmPayment)
bookingRouter.get('/user', protect, getUserBookings)
bookingRouter.get('/owner', protect, getOwnerBookings)
bookingRouter.post('/change-status', protect, changeBookingsStatus)

export default bookingRouter;