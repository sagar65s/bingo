import User from "../models/User.js";
import { store } from "../store/memoryStore.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/auth.js";
import { uid, id } from "../utils/ids.js";

const normalizeEmail = value => String(value || "").trim().toLowerCase();
const normalizeUsername = value => String(value || "").trim();

const clean = u => ({
  _id: u._id?.toString?.() || u._id,
  uid: u.uid,
  username: u.username,
  email: normalizeEmail(u.email),
  avatar: u.avatar || null
});

// Keep the in-memory store warm even when the user was loaded from MongoDB.
function cacheUser(user) {
  const plain = user?.toObject ? user.toObject() : user;
  const key = plain?._id?.toString?.() || plain?._id;
  if (!key) return plain;

  store.users.set(key, plain);
  if (plain.username) store.usersByUsername.set(String(plain.username).toLowerCase(), key);
  if (plain.email) store.usersByEmail.set(normalizeEmail(plain.email), key);
  return plain;
}

export async function register(req, res) {
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!username || !email || !password || password.length < 6) {
    return res.status(400).json({
      message: "Username, email and a 6+ character password are required"
    });
  }

  // Check both memory and MongoDB. This prevents duplicate accounts even
  // after the Node process has restarted.
  const memoryExisting = [...store.users.values()].find(
    u => String(u.username || "").toLowerCase() === username.toLowerCase() ||
         normalizeEmail(u.email) === email
  );
  if (memoryExisting) {
    return res.status(409).json({ message: "Username or email already exists" });
  }

  if (process.env.MONGODB_URI) {
    try {
      const dbExisting = await User.findOne({
        $or: [
          { username: username },
          { email: email }
        ]
      }).lean();
      if (dbExisting) {
        cacheUser(dbExisting);
        return res.status(409).json({ message: "Username or email already exists" });
      }
    } catch (error) {
      console.error("Registration database lookup failed:", error.message);
      return res.status(503).json({ message: "Database is temporarily unavailable. Please try again." });
    }
  }

  const user = {
    _id: id(),
    uid: uid(),
    username,
    email,
    passwordHash: await hashPassword(password),
    avatar: null
  };

  if (process.env.MONGODB_URI) {
    try {
      const created = await User.create(user);
      cacheUser(created);
      return res.status(201).json({ user: clean(created), token: signToken(created) });
    } catch (error) {
      // Mongoose unique indexes are the final protection against races.
      if (error?.code === 11000) {
        return res.status(409).json({ message: "Username or email already exists" });
      }
      console.error("Registration database save failed:", error.message);
      return res.status(500).json({ message: "Unable to create account. Please try again." });
    }
  }

  // Development / no-Mongo mode.
  store.users.set(user._id, user);
  store.usersByUsername.set(username.toLowerCase(), user._id);
  store.usersByEmail.set(email, user._id);
  return res.status(201).json({ user: clean(user), token: signToken(user) });
}

export async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // First check memory for fast login.
  let user = [...store.users.values()].find(u => normalizeEmail(u.email) === email);

  // IMPORTANT: memoryStore is cleared whenever the server restarts. If the
  // account exists in MongoDB, load it from the database instead of treating
  // it as a non-existent user.
  if (!user && process.env.MONGODB_URI) {
    try {
      user = await User.findOne({ email }).lean();
      if (user) cacheUser(user);
    } catch (error) {
      console.error("Login database lookup failed:", error.message);
      return res.status(503).json({ message: "Database is temporarily unavailable. Please try again." });
    }
  }

  if (!user?.passwordHash) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json({ user: clean(user), token: signToken(user) });
}

export async function me(req, res) {
  let user = store.users.get(req.auth.sub);

  // Same persistence fix for page refresh / returning users.
  if (!user && process.env.MONGODB_URI) {
    try {
      user = await User.findById(req.auth.sub).lean();
      if (user) cacheUser(user);
    } catch (error) {
      console.error("Auth /me database lookup failed:", error.message);
      return res.status(503).json({ message: "Database is temporarily unavailable. Please try again." });
    }
  }

  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user: clean(user) });
}
