import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const bookingSchema = new mongoose.Schema({
    car: {
        type: ObjectId,
        ref: "Car",
        required: true
    },
    user: {
        type: ObjectId,
        ref: "User",
        required: true
    },
    owner: {
        type: ObjectId,
        ref: "User",
        required: true
    },
    pickupDate: {
        type: Date,
        required: true
    },
    returnDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "cancelled", "completed"],
        default: "pending"
    },
    price: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending"
    },
    stripePaymentIntentId: {
        type: String,
        default: null
    },
    stripeSessionId: {
        type: String,
        default: null
    }
}, { timestamps: true });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
