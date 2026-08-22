import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  uid: { type:String, unique:true, index:true },
  username: { type:String, unique:true, index:true, trim:true },
  email: { type:String, unique:true, index:true, lowercase:true, trim:true },
  passwordHash: { type:String, required:true },
  avatar: String,
  onlineStatus: { type:Boolean, default:false },
  totalScore: { type:Number, default:0 },
  weeklyScore: { type:Number, default:0 },
  scoreWeek: { type:String, default:"" },
  totalGames: { type:Number, default:0 },
  wins: { type:Number, default:0 },
  losses: { type:Number, default:0 }
}, { timestamps:true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
