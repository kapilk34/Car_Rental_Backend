import Booking from "../models/booking.js";
import Cars from "../models/car.js";
import Stripe from "stripe";

let stripe;

const getStripe = () => {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey || !secretKey.startsWith("sk_")) {
        throw new Error("Stripe secret key is missing or invalid. Set Backend/.env STRIPE_SECRET_KEY to your sk_test_... or sk_live_... key.");
    }

    if (!stripe) {
        stripe = new Stripe(secretKey);
    }

    return stripe;
};

// Function to check availability of a car for a given date range
// Only checks for CONFIRMED bookings (not pending/unpaid bookings)
const checkAvailability = async (carId, pickupDate, returnDate) => {
    const bookings = await Booking.find({
        car: carId,
        pickupDate: { $lte: new Date(returnDate) },
        returnDate: { $gte: new Date(pickupDate) },
        status: { $in: ["confirmed", "completed"] } // Only confirmed/completed bookings block availability
    });
    return bookings.length === 0;
};

// API to check availability of cars for a given location and date range
export const checkAvailabilityOfCar = async (req, res) => {
    try {
        const { location, pickupDate, returnDate } = req.body;

        if (!location || !pickupDate || !returnDate) {
            return res.json({ success: false, message: "Missing required fields." });
        }

        const cars = await Cars.find({ location, isAvaliable: true }); 

        const availableCarsPromises = cars.map(async (car) => {
            const isAvailable = await checkAvailability(car._id, pickupDate, returnDate);
            return { ...car._doc, isAvailable };
        });

        let availableCars = await Promise.all(availableCarsPromises);
        availableCars = availableCars.filter(car => car.isAvailable);

        res.json({ success: true, availableCars });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to create a booking (initial booking with pending payment status)
export const createBooking = async (req, res) => {
    try {
        const { _id } = req.user;
        const { car, pickupDate, returnDate } = req.body;

        if (!car || !pickupDate || !returnDate) {
            return res.json({ success: false, message: "All booking details are required." });
        }

        const isAvailable = await checkAvailability(car, pickupDate, returnDate);
        if (!isAvailable) {
            return res.json({ success: false, message: "Car is not available for the selected dates." });
        }

        const carData = await Cars.findById(car);
        const startDate = new Date(pickupDate);
        const endDate = new Date(returnDate);

        let noOfDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (noOfDays === 0) noOfDays = 1; // if booked for same day, charge for 1 day
        const price = carData.pricePerDay * noOfDays;

        // Create booking with pending payment status
        const newBooking = await Booking.create({
            car,
            owner: carData.owner,
            user: _id,
            pickupDate,
            returnDate,
            price,
            status: "pending",
            paymentStatus: "pending"
        });

        res.json({ 
            success: true, 
            message: "Booking created. Proceed to payment", 
            bookingId: newBooking._id,
            amount: price
        });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to create Stripe payment intent
export const createPaymentIntent = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const { _id: userId } = req.user;

        if (!bookingId) {
            return res.json({ success: false, message: "Booking ID is required" });
        }

        // Find the booking
        const booking = await Booking.findById(bookingId).populate("car user");
        
        if (!booking) {
            return res.json({ success: false, message: "Booking not found" });
        }

        if (booking.user._id.toString() !== userId.toString()) {
            return res.json({ success: false, message: "Unauthorized access" });
        }

        if (booking.paymentStatus === "completed") {
            return res.json({ success: false, message: "Payment already completed for this booking" });
        }

        // Create a payment intent in Stripe
        const paymentIntent = await getStripe().paymentIntents.create({
            amount: Math.round(booking.price * 100), // Amount in cents
            currency: process.env.STRIPE_CURRENCY || "usd",
            metadata: {
                bookingId: bookingId,
                userId: userId.toString(),
                carId: booking.car._id.toString()
            },
            description: `Booking for ${booking.car.model} from ${booking.pickupDate} to ${booking.returnDate}`,
            receipt_email: booking.user.email
        });

        // Update booking with payment intent ID
        booking.stripePaymentIntentId = paymentIntent.id;
        await booking.save();

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            bookingId: bookingId,
            amount: booking.price
        });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to confirm payment after successful Stripe payment
export const confirmPayment = async (req, res) => {
    try {
        const { bookingId, paymentIntentId, paymentType } = req.body;
        const { _id: userId } = req.user;

        if (!bookingId) {
            return res.json({ success: false, message: "Booking ID is required" });
        }

        // Find the booking
        const booking = await Booking.findById(bookingId).populate("car", "model pricePerDay").populate("user", "name email phone").populate("owner", "name email");
        
        if (!booking) {
            return res.json({ success: false, message: "Booking not found" });
        }

        if (booking.user._id.toString() !== userId.toString()) {
            return res.json({ success: false, message: "Unauthorized access" });
        }

        if (paymentType === "now") {
            if (!paymentIntentId) {
                return res.json({ success: false, message: "Payment Intent ID is required for immediate payment" });
            }

            const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
            if (paymentIntent.status !== "succeeded") {
                return res.json({ success: false, message: "Payment was not successful" });
            }

            booking.paymentStatus = "completed";
            booking.stripePaymentIntentId = paymentIntentId;
        } else if (paymentType === "at_pickup") {
            booking.paymentStatus = "pending";
        } else {
            return res.json({ success: false, message: "Invalid payment type" });
        }

        booking.paymentType = paymentType;
        await booking.save();

        // Emit socket events
        const io = req.app.get('io');
        if (io) {
            if (paymentType === "now") {
                // Notify admin/owners about new paid booking
                io.to("owner").emit("paymentCompleted", {
                    bookingId: booking._id,
                    car: booking.car,
                    user: booking.user,
                    owner: booking.owner,
                    pickupDate: booking.pickupDate,
                    returnDate: booking.returnDate,
                    price: booking.price,
                    status: booking.status,
                    paymentStatus: booking.paymentStatus,
                    paymentType: booking.paymentType,
                    message: `Payment received for booking. Awaiting admin confirmation.`,
                    createdAt: booking.createdAt
                });
            } else if (paymentType === "at_pickup") {
                // Notify admin/owners about new booking request (payment pending)
                io.to("owner").emit("newBookingRequest", {
                    bookingId: booking._id,
                    car: booking.car,
                    user: booking.user,
                    owner: booking.owner,
                    pickupDate: booking.pickupDate,
                    returnDate: booking.returnDate,
                    price: booking.price,
                    status: booking.status,
                    paymentStatus: booking.paymentStatus,
                    paymentType: booking.paymentType,
                    message: `New booking request. Payment will be collected at pickup.`,
                    createdAt: booking.createdAt
                });
            }

            // Notify user about successful booking request
            io.to(userId.toString()).emit("paymentSuccessful", {
                bookingId: booking._id,
                status: "pending",
                paymentStatus: booking.paymentStatus,
                paymentType: booking.paymentType,
                message: paymentType === "now" 
                    ? "Your payment was successful! Your booking is pending admin confirmation."
                    : "Your booking request has been sent! Payment will be collected at pickup."
            });
        }

        res.json({ 
            success: true, 
            message: paymentType === "now"
                ? "Payment successful! Your booking is pending admin confirmation"
                : "Booking request sent! You will pay when picking up the car",
            bookingId: booking._id,
            booking: booking
        });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to list user's bookings
export const getUserBookings = async (req, res) => {
    try {
        const { _id } = req.user;
        const bookings = await Booking.find({ user: _id }).populate("car").sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to get owner's bookings
export const getOwnerBookings = async (req, res) => {
    try {
        if (req.user.role !== 'owner') {
            return res.json({ success: false, message: "Unauthorized access" });
        }

        const bookings = await Booking.find({ owner: req.user._id })
            .populate('car user')
            .select("-user.password")
            .sort({ createdAt: -1 });

        res.json({ success: true, bookings });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to change booking status (e.g., accepted, cancelled, completed)
export const changeBookingsStatus = async (req, res) => {
    try {
        const { _id } = req.user;
        const { bookingId, status } = req.body;

        const booking = await Booking.findById(bookingId).populate("user", "name email");
        if (!booking) {
            return res.json({ success: false, message: "Booking not found" });
        }

        if (booking.owner.toString() !== _id.toString()) {
            return res.json({ success: false, message: "Unauthorized action" });
        }

        booking.status = status;
        await booking.save();

        // Emit socket event for real-time notification
        const io = req.app.get('io');
        if (io) {
            io.to(booking.user._id.toString()).emit("bookingStatusUpdated", {
                bookingId: booking._id,
                status: status,
                message: `Your booking has been ${status}`,
                timestamp: new Date()
            });

            // Broadcast to all owners for dashboard update
            io.to("owner").emit("bookingStatusChanged", {
                bookingId: booking._id,
                status: status,
                updatedAt: booking.updatedAt
            });
        }

        res.json({ success: true, message: "Booking status updated successfully" });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};
