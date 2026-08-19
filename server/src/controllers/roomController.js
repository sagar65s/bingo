import { roomCode, id } from "../utils/ids.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { store } from "../store/memoryStore.js";
import { GAME_CONFIG } from "../config/gameConfig.js";
import { makeGame } from "../services/gameService.js";

export async function createRoom(req,res) {
  const {roomName="BINGO Room", password="", maxPlayers=7} = req.body || {};
  const count = Math.max(GAME_CONFIG.MIN_PLAYERS, Math.min(GAME_CONFIG.MAX_PLAYERS, Number(maxPlayers)));
  const user = store.users.get(req.auth.sub);
  if (!user) return res.status(401).json({message:"User not found"});
  let code = roomCode();
  while (store.rooms.has(code)) code = roomCode();
  const room = {
    roomId:code, roomName, passwordHash:await hashPassword(password || "bingo"),
    hostId:user._id, maxPlayers:count, status:"WAITING",
    players:[{userId:user._id,uid:user.uid,username:user.username,ready:false}]
  };
  store.rooms.set(code, room);
  res.status(201).json({room:publicRoom(room)});
}

export async function joinRoom(req,res) {
  const {roomId,password=""} = req.body || {};
  const cleanRoomId = String(roomId || "").replace(/\D/g, "").slice(0, 6);
  const room = store.rooms.get(cleanRoomId);
  if (!room) return res.status(404).json({message:"Room not found"});
  if (room.players.length >= room.maxPlayers) return res.status(409).json({message:"Room is full"});
  if (room.status !== "WAITING") return res.status(409).json({message:"Game already started"});
  if (!(await comparePassword(password, room.passwordHash))) return res.status(401).json({message:"Incorrect room password"});
  if (room.players.some(p=>p.userId===req.auth.sub)) return res.status(409).json({message:"Already in room"});
  const user = store.users.get(req.auth.sub);
  room.players.push({userId:user._id,uid:user.uid,username:user.username,ready:false});
  res.json({room:publicRoom(room)});
}

export function publicRoom(room) {
  return {roomId:room.roomId,roomName:room.roomName,hostId:room.hostId,maxPlayers:room.maxPlayers,status:room.status,players:room.players.map(({userId,uid,username,ready})=>({userId,uid,username,ready}))};
}

export function roomFromId(roomId){ return store.rooms.get(roomId); }

export function startRoom(room) {
  if (room.players.length < 2) throw new Error("At least 2 players are required");
  if (!room.players.every(p=>p.ready)) throw new Error("Every player must be ready");
  room.status = "PLAYING";
  const game = makeGame(room);
  store.games.set(game.gameId, game);
  room.gameId = game.gameId;
  return game;
}
