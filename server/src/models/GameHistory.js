import mongoose from "mongoose";

const GameHistorySchema = new mongoose.Schema({
  gameId:String,
  roomId:String,
  roomName:String,
  playerCount:Number,
  duration:Number,
  winner:String,
  drawPlayers:[String],
  outPlayer:String,
  finalRanking:[mongoose.Schema.Types.Mixed]
}, {timestamps:true});

export default mongoose.models.GameHistory || mongoose.model("GameHistory", GameHistorySchema);
