import http from "node:http";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";

import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";

import { configureSockets } from "./sockets/socketServer.js";

const app = express();
const httpServer = http.createServer(app);

/* --------------------------------------------------
   CORS
-------------------------------------------------- */

const allowedOrigins = [
  env.clientUrl,

  // Capacitor Android / local app origin
  "http://localhost",
  "https://localhost",

  // Local Vite development
  "http://localhost:5173",
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Requests like mobile/native tools may not send an Origin header.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

/* --------------------------------------------------
   Body parser
-------------------------------------------------- */

app.use(
  express.json({
    limit: "1mb",
  })
);

/* --------------------------------------------------
   Health check
-------------------------------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    service: "bingo-server",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/* --------------------------------------------------
   Routes
-------------------------------------------------- */

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/players", playerRoutes);

/* --------------------------------------------------
   404 handler
-------------------------------------------------- */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* --------------------------------------------------
   Error handler
-------------------------------------------------- */

app.use((err, _req, res, _next) => {
  console.error("Server error:", err);

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Request blocked by CORS",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

/* --------------------------------------------------
   Socket.IO
-------------------------------------------------- */

const io = new SocketIOServer(httpServer, {
  cors: {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`Socket.IO CORS blocked origin: ${origin}`);

      return callback(new Error("Not allowed by Socket.IO CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
    ],
  },

  transports: [
    "websocket",
    "polling",
  ],
});

configureSockets(io);

/* --------------------------------------------------
   Start server
-------------------------------------------------- */

try {
  await connectDatabase();

  httpServer.listen(env.port, "0.0.0.0", () => {
    console.log(`BINGO server running on port ${env.port}`);
    console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
  });
} catch (error) {
  console.error("Failed to start BINGO server:", error);
  process.exit(1);
}