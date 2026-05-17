import Booking from "../models/booking.js";
import Cars from "../models/car.js";

// Function to check availability of a car for a given date range
const checkAvailability = async (carId, pickupDate, returnDate) => {
    const bookings = await Booking.find({
        car: carId,
        pickupDate: { $lte: new Date(returnDate) },
        returnDate: { $gte: new Date(pickupDate) },
        status: { $ne: "cancelled" }
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

        const cars = await Cars.find({ location, isAvaliable: true }); // spelling is isAvaliable in schema

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

// API to create a booking
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

        await Booking.create({
            car,
            owner: carData.owner,
            user: _id,
            pickupDate,
            returnDate,
            price
        });

        res.json({ success: true, message: "Booking Created Successfully" });

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

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.json({ success: false, message: "Booking not found" });
        }

        if (booking.owner.toString() !== _id.toString()) {
            return res.json({ success: false, message: "Unauthorized action" });
        }

        booking.status = status;
        await booking.save();

        res.json({ success: true, message: "Booking status updated successfully" });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};
