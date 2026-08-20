import mongoose from 'mongoose';
import User from '../models/User.js';
import { store } from '../store/memoryStore.js';
const online=()=>[...store.users.values()].filter(u=>store.onlineSockets.has(String(u._id)));
export function onlinePlayers(req,res){const me=String(req.auth.sub);res.json({players:online().filter(u=>String(u._id)!==me).map(u=>({userId:String(u._id),uid:u.uid,username:u.username,online:true}))});}
export async function leaderboard(_req,res){let players;if(mongoose.connection.readyState===1){players=await User.find({},'username uid totalScore totalGames wins').sort({totalScore:-1,wins:-1,updatedAt:1}).limit(10).lean();}else{players=[...store.users.values()].map(u=>({username:u.username,uid:u.uid,totalScore:u.totalScore||0,totalGames:u.totalGames||0,wins:u.wins||0})).sort((a,b)=>b.totalScore-a.totalScore||b.wins-a.wins).slice(0,10);}res.json({players});}
