import http from "node:http";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import { configureSockets } from "./sockets/socketServer.js";

const app = express();
const httpServer = http.createServer(app);

app.use(cors({origin:env.clientUrl, credentials:true}));
app.use(express.json({limit:"1mb"}));

app.get("/api/health", (_req,res)=>res.json({
  success:true, service:"bingo-server", status:"healthy", timestamp:new Date().toISOString()
}));

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/history", historyRoutes);

app.use((err,_req,res,_next)=>{
  console.error(err);
  res.status(500).json({message:"Internal server error"});
});

const io = new SocketIOServer(httpServer, {
  cors:{origin:env.clientUrl,credentials:true}
});
configureSockets(io);

await connectDatabase();

httpServer.listen(env.port, ()=>console.log(`BINGO server listening on http://localhost:${env.port}`));
