import mongoose from "mongoose";
import User from "../models/User.js";
import { store } from "../store/memoryStore.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/auth.js";
import { uid, id } from "../utils/ids.js";

const normalizeEmail = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeUsername = (value) =>
  String(value || "").trim();

const mongoReady = () =>
  Boolean(process.env.MONGODB_URI) &&
  mongoose.connection.readyState === 1;

const clean = (user) => ({
  _id: user?._id?.toString?.() || user?._id,
  uid: user?.uid,
  username: user?.username,
  email: normalizeEmail(user?.email),
  avatar: user?.avatar || null,
});

function cacheUser(user) {
  const plain = user?.toObject ? user.toObject() : user;

  const key = plain?._id?.toString?.() || plain?._id;

  if (!key) {
    return plain;
  }

  const userId = String(key);

  store.users.set(userId, plain);

  if (plain.username) {
    store.usersByUsername.set(
      String(plain.username).trim().toLowerCase(),
      userId
    );
  }

  if (plain.email) {
    store.usersByEmail.set(
      normalizeEmail(plain.email),
      userId
    );
  }

  return plain;
}

export async function register(req, res) {
  try {
    const username = normalizeUsername(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!username || !email || password.length < 6) {
      return res.status(400).json({
        message:
          "Username, email and a 6+ character password are required",
      });
    }

    /*
      First check in-memory users.
      This prevents duplicate users during the current server session.
    */
    const memoryExisting = [...store.users.values()].find(
      (user) =>
        String(user.username || "")
          .trim()
          .toLowerCase() === username.toLowerCase() ||
        normalizeEmail(user.email) === email
    );

    if (memoryExisting) {
      return res.status(409).json({
        message: "Username or email already exists",
      });
    }

    /*
      MongoDB mode
    */
    if (mongoReady()) {
      try {
        const dbExisting = await User.findOne({
          $or: [
            { username },
            { email },
          ],
        }).lean();

        if (dbExisting) {
          cacheUser(dbExisting);

          return res.status(409).json({
            message: "Username or email already exists",
          });
        }

        const created = await User.create({
          uid: uid(),
          username,
          email,
          passwordHash: await hashPassword(password),
          avatar: null,
        });

        const plainUser = cacheUser(created);

        return res.status(201).json({
          user: clean(plainUser),
          token: signToken(plainUser),
        });
      } catch (error) {
        if (error?.code === 11000) {
          return res.status(409).json({
            message: "Username or email already exists",
          });
        }

        console.error("Registration database error:", error);

        return res.status(500).json({
          message:
            "Unable to create account. Please check the server database connection.",
        });
      }
    }

    /*
      In-memory mode
      MongoDB is not connected.
    */
    const user = {
      _id: id(),
      uid: uid(),
      username,
      email,
      passwordHash: await hashPassword(password),
      avatar: null,
    };

    cacheUser(user);

    return res.status(201).json({
      user: clean(user),
      token: signToken(user),
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Unable to create account",
    });
  }
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    /*
      First check memory cache.
    */
    let user = [...store.users.values()].find(
      (item) => normalizeEmail(item.email) === email
    );

    /*
      If user is not in memory,
      search MongoDB.
    */
    if (!user && mongoReady()) {
      try {
        user = await User.findOne({ email }).lean();

        if (user) {
          cacheUser(user);
        }
      } catch (error) {
        console.error("Login database error:", error);

        return res.status(503).json({
          message:
            "Database is temporarily unavailable. Please try again.",
        });
      }
    }

    if (!user?.passwordHash) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const validPassword = await comparePassword(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    return res.json({
      user: clean(user),
      token: signToken(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to login",
    });
  }
}

export async function me(req, res) {
  try {
    const userId = String(req.auth?.sub || "");

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    /*
      Check memory first.
    */
    let user = store.users.get(userId);

    /*
      If not found in memory,
      load from MongoDB.
    */
    if (!user && mongoReady()) {
      try {
        user = await User.findById(userId).lean();

        if (user) {
          cacheUser(user);
        }
      } catch (error) {
        console.error("Auth /me database error:", error);

        return res.status(503).json({
          message:
            "Database is temporarily unavailable. Please try again.",
        });
      }
    }

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      user: clean(user),
    });
  } catch (error) {
    console.error("Auth /me error:", error);

    return res.status(500).json({
      message: "Unable to get user information",
    });
  }
}