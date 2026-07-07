import Booking from "../models/booking.js";

// Map to store user socket connections
const userSocketMap = new Map(); // userId -> socketId
const ownerSocketMap = new Map(); // ownerId -> socketId
const adminSockets = new Set(); // socketIds of admins/owners

export const initializeSocketHandlers = (io) => {
    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        // When user joins
        socket.on("userJoined", (userId, userType) => {
            console.log(`${userType} ${userId} joined with socket ${socket.id}`);
            
            if (userType === "owner" || userType === "admin") {
                ownerSocketMap.set(userId, socket.id);
                adminSockets.add(socket.id);
            } else if (userType === "user") {
                userSocketMap.set(userId, socket.id);
            }

            socket.join(userId);
            socket.join(userType); // Join room by user type for broadcasting
            socket.userType = userType;
            socket.userId = userId;

            // Notify everyone of user online status
            io.emit("userOnline", { userId, userType, status: "online" });
        });

        // Listen for new booking creation from clients
        socket.on("newBookingCreated", async (bookingData) => {
            try {
                console.log("New booking created event received:", bookingData);

                const booking = await Booking.findById(bookingData.bookingId)
                    .populate("car", "model pricePerDay")
                    .populate("user", "name email phone")
                    .populate("owner", "name email");

                if (booking) {
                    // Emit to admin/owner dashboard
                    io.to("owner").emit("newBooking", {
                        bookingId: booking._id,
                        car: booking.car,
                        user: booking.user,
                        owner: booking.owner,
                        pickupDate: booking.pickupDate,
                        returnDate: booking.returnDate,
                        price: booking.price,
                        status: booking.status,
                        createdAt: booking.createdAt
                    });

                    // Emit to specific user
                    const userSocket = userSocketMap.get(booking.user._id.toString());
                    if (userSocket) {
                        io.to(userSocket).emit("bookingCreated", {
                            bookingId: booking._id,
                            status: "pending",
                            message: "Your booking has been created and is pending approval"
                        });
                    }
                }
            } catch (error) {
                console.error("Error handling new booking:", error);
            }
        });

        // Listen for booking status updates from admin/owner
        socket.on("updateBookingStatus", async (data) => {
            try {
                const { bookingId, newStatus } = data;
                console.log(`Updating booking ${bookingId} status to ${newStatus}`);

                const booking = await Booking.findById(bookingId)
                    .populate("user", "name email")
                    .populate("owner", "name email");

                if (!booking) {
                    socket.emit("error", { message: "Booking not found" });
                    return;
                }

                // Update status in database (should be done from controller too)
                booking.status = newStatus;
                await booking.save();

                // Emit to specific user
                const userSocket = userSocketMap.get(booking.user._id.toString());
                if (userSocket) {
                    io.to(userSocket).emit("bookingStatusUpdated", {
                        bookingId: booking._id,
                        status: newStatus,
                        message: `Your booking has been ${newStatus}`,
                        timestamp: new Date()
                    });
                }

                // Broadcast to all owners for dashboard update
                io.to("owner").emit("bookingStatusChanged", {
                    bookingId: booking._id,
                    status: newStatus,
                    updatedAt: booking.updatedAt
                });

                // Send confirmation to admin who made the change
                socket.emit("bookingStatusUpdateSuccess", {
                    bookingId: booking._id,
                    status: newStatus,
                    message: "Booking status updated successfully"
                });

            } catch (error) {
                console.error("Error updating booking status:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Admin retrieves all bookings for the dashboard
        socket.on("requestAllBookings", async (ownerId) => {
            try {
                const bookings = await Booking.find({ owner: ownerId })
                    .populate("car", "model pricePerDay location")
                    .populate("user", "name email phone")
                    .sort({ createdAt: -1 });

                socket.emit("allBookings", {
                    bookings: bookings.map(booking => ({
                        bookingId: booking._id,
                        car: booking.car,
                        user: booking.user,
                        pickupDate: booking.pickupDate,
                        returnDate: booking.returnDate,
                        price: booking.price,
                        status: booking.status,
                        createdAt: booking.createdAt
                    }))
                });
            } catch (error) {
                console.error("Error fetching bookings:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // User retrieves their bookings
        socket.on("requestUserBookings", async (userId) => {
            try {
                const bookings = await Booking.find({ user: userId })
                    .populate("car", "model pricePerDay location")
                    .populate("owner", "name email")
                    .sort({ createdAt: -1 });

                socket.emit("userBookings", {
                    bookings: bookings.map(booking => ({
                        bookingId: booking._id,
                        car: booking.car,
                        owner: booking.owner,
                        pickupDate: booking.pickupDate,
                        returnDate: booking.returnDate,
                        price: booking.price,
                        status: booking.status,
                        createdAt: booking.createdAt
                    }))
                });
            } catch (error) {
                console.error("Error fetching user bookings:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Handle disconnect
        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);

            // Remove from maps
            if (socket.userType === "owner" || socket.userType === "admin") {
                ownerSocketMap.delete(socket.userId);
                adminSockets.delete(socket.id);
            } else if (socket.userType === "user") {
                userSocketMap.delete(socket.userId);
            }

            // Notify everyone of user offline status
            io.emit("userOffline", { userId: socket.userId, userType: socket.userType, status: "offline" });
        });
    });
};