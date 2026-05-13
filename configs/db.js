// import mongoose from "mongoose";

// const connectDB = async()=>{
//     try{
//         mongoose.connection.on('connnected', ()=>console.log("Database Connected"));
//         await mongoose.connect(`${process.env.MONGO_URI}/car-rental`)
//     }catch(error){
//         console.log(error.message);
//     }
// }

// export default connectDB;


import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database Connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

export default connectDB;