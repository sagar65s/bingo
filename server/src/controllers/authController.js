import User from "../models/User.js";
import { store } from "../store/memoryStore.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/auth.js";
import { uid, id } from "../utils/ids.js";

const clean = u => ({_id:u._id?.toString?.() || u._id, uid:u.uid, username:u.username, email:u.email, avatar:u.avatar || null});

export async function register(req, res) {
  const {username, email, password} = req.body || {};
  if (!username || !email || !password || password.length < 6)
    return res.status(400).json({message:"Username, email and a 6+ character password are required"});

  const existing = [...store.users.values()].find(u => u.username === username || u.email === email);
  if (existing) return res.status(409).json({message:"Username or email already exists"});

  const user = {_id:id(), uid:uid(), username, email:email.toLowerCase(), passwordHash:await hashPassword(password), avatar:null};
  store.users.set(user._id, user);
  store.usersByUsername.set(username.toLowerCase(), user._id);
  store.usersByEmail.set(user.email, user._id);

  try { await User.create(user); } catch (_) {}
  return res.status(201).json({user:clean(user), token:signToken(user)});
}

export async function login(req, res) {
  const {email, password} = req.body || {};
  const user = [...store.users.values()].find(u => u.email === String(email || "").toLowerCase());
  if (!user || !(await comparePassword(password || "", user.passwordHash)))
    return res.status(401).json({message:"Invalid email or password"});
  return res.json({user:clean(user), token:signToken(user)});
}

export async function me(req, res) {
  const user = store.users.get(req.auth.sub);
  if (!user) return res.status(404).json({message:"User not found"});
  res.json({user:clean(user)});
}
