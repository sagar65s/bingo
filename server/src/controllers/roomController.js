import { roomCode } from "../utils/ids.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { store } from "../store/memoryStore.js";
import { GAME_CONFIG } from "../config/gameConfig.js";
import { makeGame } from "../services/gameService.js";

export async function createRoom(req,res) {
  const {roomName="BINGO Room",password="",maxPlayers=7} = req.body || {};
  const count = Number(maxPlayers);
  if (!Number.isInteger(count) || count<GAME_CONFIG.MIN_PLAYERS || count>GAME_CONFIG.MAX_PLAYERS) return res.status(400).json({message:"Players must be between 2 and 7"});
  const user = store.users.get(String(req.auth.sub));
  if (!user) return res.status(401).json({message:"User not found"});
  let code=roomCode(); while(store.rooms.has(code)) code=roomCode();
  const room={roomId:code,roomName:String(roomName||"BINGO Room").trim().slice(0,50)||"BINGO Room",passwordHash:await hashPassword(String(password||"bingo")),hostId:String(user._id),maxPlayers:count,status:"WAITING",players:[{userId:String(user._id),uid:user.uid,username:user.username,ready:false}],gameId:null,rematchReady:new Set()};
  store.rooms.set(code,room);
  res.status(201).json({room:publicRoom(room)});
}

export async function joinRoom(req,res) {
  const roomId=String(req.body?.roomId||"").replace(/\D/g,"").slice(0,6);
  const password=String(req.body?.password||"");
  const room=store.rooms.get(roomId);
  if(!room)return res.status(404).json({message:"Room not found"});
  if(room.status!=="WAITING")return res.status(409).json({message:"Game already started"});
  if(room.players.length>=room.maxPlayers)return res.status(409).json({message:"Room is full"});
  if(!(await comparePassword(password,room.passwordHash)))return res.status(401).json({message:"Incorrect room password"});
  const user=store.users.get(String(req.auth.sub));
  if(!user)return res.status(401).json({message:"User not found"});
  if(room.players.some(p=>p.userId===String(user._id)))return res.status(409).json({message:"Already in room"});
  room.players.push({userId:String(user._id),uid:user.uid,username:user.username,ready:false});
  res.json({room:publicRoom(room)});
}

export function publicRoom(room){return {roomId:room.roomId,roomName:room.roomName,hostId:room.hostId,maxPlayers:room.maxPlayers,status:room.status,gameId:room.gameId||null,players:room.players.map(({userId,uid,username,ready})=>({userId,uid,username,ready}))};}
export function startRoom(room){
  if(room.players.length<2)throw new Error("At least 2 players are required");
  if(!room.players.every(p=>p.ready))throw new Error("Every player must be ready");
  room.status="PLAYING"; room.rematchReady=new Set();
  const game=makeGame(room); store.games.set(game.gameId,game); room.gameId=game.gameId; return game;
}
