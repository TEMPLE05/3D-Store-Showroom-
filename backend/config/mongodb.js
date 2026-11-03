import mongoose from "mongoose";


const connectDB = async ()=> {

    mongoose.connection.on('connected',() =>{
        console.log("DB Connected");
    })

    await mongoose.connect(`${process.env.MONGODB_URI}/E-STORE`, {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    })
}

export default connectDB;