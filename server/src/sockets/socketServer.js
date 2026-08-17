import { verifyToken } from "../utils/auth.js";
import { store } from "../store/memoryStore.js";
import { publicRoom, startRoom } from "../controllers/roomController.js";
import { submitBoard, callNumber } from "../services/gameService.js";

export function configureSockets(io) {
  io.use((socket,next)=>{
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      socket.user = verifyToken(token);
      next();
    } catch {
      next(new Error("Invalid socket authentication"));
    }
  });

  io.on("connection", socket=>{
    socket.emit("server:ready",{message:"BINGO real-time server connected"});

    socket.on("room:join", ({roomId})=>{
      const room = store.rooms.get(String(roomId||"").toUpperCase());
      if (!room) return socket.emit("error:message",{message:"Room not found"});
      if (!room.players.some(p=>p.userId===socket.user.sub)) return socket.emit("error:message",{message:"You are not a room member"});
      socket.join(room.roomId);
      io.to(room.roomId).emit("room:update",{room:publicRoom(room), gameId:room.gameId||null});
    });

    socket.on("room:ready", ({roomId,ready})=>{
      const room=store.rooms.get(String(roomId||"").toUpperCase());
      if(!room) return;
      const p=room.players.find(p=>p.userId===socket.user.sub);
      if(!p) return;
      p.ready=Boolean(ready);
      io.to(room.roomId).emit("room:update",{room:publicRoom(room),gameId:room.gameId||null});
    });

    socket.on("room:start", ({roomId})=>{
      try {
        const room=store.rooms.get(String(roomId||"").toUpperCase());
        if(!room) throw new Error("Room not found");
        if(room.hostId!==socket.user.sub) throw new Error("Only the host can start");
        const game=startRoom(room);
        io.to(room.roomId).emit("room:started",{room:publicRoom(room),game});
      } catch(e) { socket.emit("error:message",{message:e.message}); }
    });

    socket.on("game:join", ({gameId})=>{
      const game=store.games.get(gameId);
      if(!game || !game.players.some(p=>p.userId===socket.user.sub)) return;
      socket.join(game.roomId);
      socket.emit("game:state",{game});
    });

    socket.on("game:boardSubmit", ({gameId,board})=>{
      try {
        const game=store.games.get(gameId);
        if(!game) throw new Error("Game not found");
        submitBoard(game,socket.user.sub,board);
        io.to(game.roomId).emit("game:state",{game});
      } catch(e){ socket.emit("error:message",{message:e.message}); }
    });

    socket.on("game:numberCall", ({gameId,number})=>{
      try {
        const game=store.games.get(gameId);
        if(!game) throw new Error("Game not found");
        const result=callNumber(game,socket.user.sub,Number(number));
        io.to(game.roomId).emit("game:move",{
          game:result.game,
          actor:result.actor,
          number:result.number,
          resultEvent:result.resultEvent
        });
      } catch(e){ socket.emit("error:message",{message:e.message}); }
    });

    socket.on("game:reconnect", ({gameId})=>{
      const game=store.games.get(gameId);
      if(game && game.players.some(p=>p.userId===socket.user.sub)) {
        socket.join(game.roomId);
        socket.emit("game:state",{game});
      }
    });
  });
}
