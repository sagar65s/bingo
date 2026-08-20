import mongoose from "mongoose";
import User from "../models/User.js";
import { store } from "../store/memoryStore.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/auth.js";
import { uid, id } from "../utils/ids.js";

const normalizeEmail = value => String(value || "").trim().toLowerCase();
const normalizeUsername = value => String(value || "").trim();
const mongoReady = () => Boolean(process.env.MONGODB_URI) && mongoose.connection.readyState === 1;
const clean = u => ({ _id:u?._id?.toString?.() || u?._id, uid:u?.uid, username:u?.username, email:normalizeEmail(u?.email), avatar:u?.avatar || null });

function cacheUser(user) {
  const plain = user?.toObject ? user.toObject() : user;
  const key = plain?._id?.toString?.() || plain?._id;
  if (!key) return plain;
  store.users.set(String(key), plain);
  if (plain.username) store.usersByUsername.set(String(plain.username).trim().toLowerCase(), String(key));
  if (plain.email) store.usersByEmail.set(normalizeEmail(plain.email), String(key));
  return plain;
}

export async function register(req,res) {
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!username || !email || password.length < 6) return res.status(400).json({message:"Username, email and a 6+ character password are required"});

  const memExisting = [...store.users.values()].find(u => String(u.username||"").trim().toLowerCase() === username.toLowerCase() || normalizeEmail(u.email) === email);
  if (memExisting) return res.status(409).json({message:"Username or email already exists"});

  if (mongoReady()) {
    try {
      const existing = await User.findOne({$or:[{username},{email}]}).lean();
      if (existing) { cacheUser(existing); return res.status(409).json({message:"Username or email already exists"}); }
      const created = await User.create({uid:uid(),username,email,passwordHash:await hashPassword(password),avatar:null});
      const user = cacheUser(created);
      return res.status(201).json({user:clean(user),token:signToken(user)});
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({message:"Username or email already exists"});
      console.error("Registration database error:",error);
      return res.status(500).json({message:"Unable to create account. Please check the database connection."});
    }
  }

  const user = {_id:id(),uid:uid(),username,email,passwordHash:await hashPassword(password),avatar:null};
  cacheUser(user);
  return res.status(201).json({user:clean(user),token:signToken(user)});
}

export async function login(req,res) {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(401).json({message:"Invalid email or password"});

  let user = [...store.users.values()].find(u => normalizeEmail(u.email) === email);
  if (!user && mongoReady()) {
    try { user = await User.findOne({email}).lean(); if (user) cacheUser(user); }
    catch (error) { console.error("Login database error:",error); return res.status(503).json({message:"Database is temporarily unavailable. Please try again."}); }
  }
  if (!user?.passwordHash || !(await comparePassword(password,user.passwordHash))) return res.status(401).json({message:"Invalid email or password"});
  return res.json({user:clean(user),token:signToken(user)});
}

export async function me(req,res) {
  let user = store.users.get(String(req.auth.sub));
  if (!user && mongoReady()) {
    try { user = await User.findById(req.auth.sub).lean(); if (user) cacheUser(user); }
    catch (error) { console.error("/auth/me database error:",error); return res.status(503).json({message:"Database is temporarily unavailable. Please try again."}); }
  }
  if (!user) return res.status(404).json({message:"User not found"});
  res.json({user:clean(user)});
}
