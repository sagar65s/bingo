import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  if (!env.mongodbUri) {
    console.warn("MONGODB_URI is not configured. Running with in-memory persistence.");
    return false;
  }
  try {
    await mongoose.connect(env.mongodbUri);
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    console.warn("MongoDB connection failed; continuing in memory:", error.message);
    return false;
  }
}
