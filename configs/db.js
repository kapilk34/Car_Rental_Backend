import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database Connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1); //Stops the server without connecting to the database
  }
};

export default connectDB;