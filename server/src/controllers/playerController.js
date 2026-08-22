import mongoose from 'mongoose';
import User from '../models/User.js';
import { store } from '../store/memoryStore.js';

const online=()=>[...store.users.values()].filter(u=>store.onlineSockets.has(String(u._id)));

// Monday 00:00 UTC starts a new weekly leaderboard period.
export function currentWeekKey(date=new Date()){
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()-day+1);
  return d.toISOString().slice(0,10);
}

function normalizeMemoryUser(user,week){
  if(user.scoreWeek!==week){
    user.scoreWeek=week;
    user.weeklyScore=0;
  }
  if(typeof user.weeklyScore!=='number') user.weeklyScore=0;
  return user;
}

export function onlinePlayers(req,res){
  const me=String(req.auth.sub);
  res.json({players:online().filter(u=>String(u._id)!==me).map(u=>({
    userId:String(u._id),uid:u.uid,username:u.username,online:true
  }))});
}

export async function leaderboard(_req,res){
  const week=currentWeekKey();
  let players;

  if(mongoose.connection.readyState===1){
    // Lazily reset all old weekly records before returning the Top 10.
    await User.updateMany(
      {$or:[{scoreWeek:{$ne:week}},{scoreWeek:{$exists:false}}]},
      {$set:{weeklyScore:0,scoreWeek:week}}
    );
    players=await User.find({},'username uid weeklyScore totalGames wins')
      .sort({weeklyScore:-1,wins:-1,updatedAt:1})
      .limit(10)
      .lean();
  }else{
    players=[...store.users.values()]
      .map(u=>normalizeMemoryUser(u,week))
      .map(u=>({username:u.username,uid:u.uid,weeklyScore:u.weeklyScore||0,totalGames:u.totalGames||0,wins:u.wins||0}))
      .sort((a,b)=>b.weeklyScore-a.weeklyScore||b.wins-a.wins||String(a.username).localeCompare(String(b.username)))
      .slice(0,10);
  }

  res.json({week,players});
}
