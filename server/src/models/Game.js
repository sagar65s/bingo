import mongoose from "mongoose";

const GameSchema = new mongoose.Schema({
  gameId: {type:String, unique:true, index:true},
  roomId: {type:String, index:true},
  playerCount:Number,
  boardSize:Number,
  requiredLines:Number,
  status:{type:String, default:"WAITING"},
  currentTurn:String,
  turnNumber:{type:Number, default:0},
  calledNumbers:[Number],
  players:[{
    userId:String,
    uid:String,
    username:String,
    board:[[mongoose.Schema.Types.Mixed]],
    completedLines:{type:Number, default:0},
    completedLineKeys:[String],
    rank:Number,
    points:{type:Number, default:0},
    status:{type:String, default:"PLAYING"},
    ready:{type:Boolean, default:false}
  }],
  startedAt:Date,
  endedAt:Date
}, {timestamps:true});

export default mongoose.models.Game || mongoose.model("Game", GameSchema);
