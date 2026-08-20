import { store } from "../store/memoryStore.js";

export function onlinePlayers(req,res) {
  const me = String(req.auth.sub);
  const players = [...store.users.values()]
    .filter(u => String(u._id) !== me && store.onlineSockets.has(String(u._id)))
    .map(u => ({userId:String(u._id),uid:u.uid,username:u.username,avatar:u.avatar||null,online:true}));
  res.json({players});
}
