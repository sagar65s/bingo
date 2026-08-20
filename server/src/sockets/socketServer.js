import { verifyToken } from "../utils/auth.js";
import { store } from "../store/memoryStore.js";
import {
  publicRoom,
  startRoom
} from "../controllers/roomController.js";
import {
  submitBoard,
  callNumber
} from "../services/gameService.js";
import { id } from "../utils/ids.js";


const normalizeRoomId = value =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);


function onlineList(exceptId = null) {
  return [...store.users.values()]
    .filter(user => {
      const userId = String(user._id);

      return (
        userId !== String(exceptId) &&
        store.onlineSockets.has(userId)
      );
    })
    .map(user => ({
      userId: String(user._id),
      uid: user.uid,
      username: user.username,
      avatar: user.avatar || null,
      online: true
    }));
}


function emitPresence(io) {
  for (const client of io.sockets.sockets.values()) {
    const currentUserId = String(
      client.user?.sub || ""
    );

    client.emit("presence:list", {
      players: onlineList(currentUserId)
    });
  }
}


function socketsFor(userId) {
  return [
    ...(store.onlineSockets.get(String(userId)) || [])
  ];
}


function emitRoom(io, room) {
  io.to(room.roomId).emit("room:update", {
    room: publicRoom(room),
    gameId: room.gameId || null
  });
}


/*
  Send a player's own board only to that player.

  Other players should not receive another player's board.
*/
function publicGame(game, userId) {
  return {
    ...game,

    players: game.players.map(player => {
      const isCurrentUser =
        String(player.userId) === String(userId);

      return {
        ...player,
        board: isCurrentUser
          ? player.board
          : []
      };
    })
  };
}


function finishToHistory(game) {
  const finalRanking = [...game.players]
    .sort(
      (a, b) =>
        (a.rank ?? 999) -
        (b.rank ?? 999)
    )
    .map(player => ({
      userId: player.userId,
      uid: player.uid,
      username: player.username,
      rank: player.rank,
      status: player.status,
      points: player.points,
      completedLines: player.completedLines
    }));


  store.histories.set(game.gameId, {
    gameId: game.gameId,
    roomId: game.roomId,
    playerCount: game.playerCount,
    startedAt: game.startedAt,
    endedAt: game.endedAt,

    winner:
      game.players.find(
        player => player.rank === 1
      )?.username || null,

    drawPlayers: game.players
      .filter(player => player.status === "DRAW")
      .map(player => player.username),

    outPlayer:
      game.players.find(
        player => player.status === "OUT"
      )?.username || null,

    finalRanking
  });
}


function emitGameToRoom(io, eventName, game, extra = {}) {
  const socketIds =
    io.sockets.adapter.rooms.get(game.roomId) || [];

  for (const socketId of socketIds) {
    const client =
      io.sockets.sockets.get(socketId);

    if (!client) continue;

    const currentUserId = String(
      client.user?.sub || ""
    );

    client.emit(eventName, {
      game: publicGame(game, currentUserId),
      ...extra
    });
  }
}


function startGameForRoom(io, room) {
  const game = startRoom(room);

  const socketIds =
    io.sockets.adapter.rooms.get(room.roomId) || [];

  for (const socketId of socketIds) {
    const client =
      io.sockets.sockets.get(socketId);

    if (!client) continue;

    client.join(game.roomId);

    client.emit("room:started", {
      room: publicRoom(room),

      game: {
        ...game,

        players: game.players.map(player => ({
          ...player,
          board: []
        }))
      }
    });
  }

  return game;
}


export function configureSockets(io) {

  /*
    SOCKET AUTHENTICATION
  */
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token;

      if (!token) {
        return next(
          new Error("Authentication required")
        );
      }

      socket.user = verifyToken(token);

      next();

    } catch (error) {
      next(
        new Error("Invalid socket authentication")
      );
    }
  });


  /*
    SOCKET CONNECTION
  */
  io.on("connection", socket => {

    const userId =
      String(socket.user.sub);


    /*
      ONLINE PLAYER TRACKING
    */
    if (!store.onlineSockets.has(userId)) {
      store.onlineSockets.set(
        userId,
        new Set()
      );
    }

    store.onlineSockets
      .get(userId)
      .add(socket.id);


    socket.emit("server:ready", {
      message:
        "BINGO real-time server connected"
    });


    emitPresence(io);


    /*
      ROOM JOIN
    */
    socket.on(
      "room:join",
      ({ roomId }, ack) => {

        const normalizedRoomId =
          normalizeRoomId(roomId);

        const room =
          store.rooms.get(normalizedRoomId);


        if (!room) {
          const response = {
            ok: false,
            message: "Room not found"
          };

          socket.emit(
            "error:message",
            {
              message: response.message
            }
          );

          ack?.(response);

          return;
        }


        const isMember =
          room.players.some(
            player =>
              String(player.userId) === userId
          );


        if (!isMember) {
          const response = {
            ok: false,
            message:
              "You are not a room member"
          };

          socket.emit(
            "error:message",
            {
              message: response.message
            }
          );

          ack?.(response);

          return;
        }


        socket.join(room.roomId);

        emitRoom(io, room);

        ack?.({
          ok: true,
          room: publicRoom(room)
        });
      }
    );


    /*
      LEAVE ROOM
    */
    socket.on(
      "room:leave",
      ({ roomId }) => {

        const room =
          store.rooms.get(
            normalizeRoomId(roomId)
          );

        if (!room) return;


        room.players =
          room.players.filter(
            player =>
              String(player.userId) !== userId
          );


        room.rematchReady?.delete(userId);


        if (
          String(room.hostId) === userId &&
          room.players.length > 0
        ) {
          room.hostId =
            room.players[0].userId;
        }


        if (room.players.length === 0) {

          store.rooms.delete(
            room.roomId
          );

        } else {

          room.status = "WAITING";

          room.gameId = null;

          for (
            const player of room.players
          ) {
            player.ready = false;
          }

          emitRoom(io, room);
        }


        socket.leave(room.roomId);
      }
    );


    /*
      PLAYER READY
    */
    socket.on(
      "room:ready",
      ({ roomId, ready }) => {

        const room =
          store.rooms.get(
            normalizeRoomId(roomId)
          );

        if (!room) return;


        if (
          room.status !== "WAITING"
        ) {
          socket.emit(
            "error:message",
            {
              message:
                "Room is not waiting for players"
            }
          );

          return;
        }


        const player =
          room.players.find(
            item =>
              String(item.userId) === userId
          );


        if (!player) return;


        player.ready = Boolean(ready);


        emitRoom(io, room);


        /*
          AUTO START

          Game automatically starts when:
          - minimum 2 players
          - everyone is ready
        */
        const everyoneReady =
          room.players.length >= 2 &&
          room.players.every(
            item => item.ready
          );


        if (!everyoneReady) return;


        try {

          startGameForRoom(io, room);

        } catch (error) {

          console.error(
            "Auto start game error:",
            error
          );

          socket.emit(
            "error:message",
            {
              message:
                error.message ||
                "Unable to start game"
            }
          );
        }
      }
    );


    /*
      HOST START GAME

      Kept for manual start compatibility.
    */
    socket.on(
      "room:start",
      ({ roomId }) => {

        try {

          const room =
            store.rooms.get(
              normalizeRoomId(roomId)
            );


          if (!room) {
            throw new Error(
              "Room not found"
            );
          }


          if (
            String(room.hostId) !== userId
          ) {
            throw new Error(
              "Only the host can start"
            );
          }


          if (
            room.players.length < 2
          ) {
            throw new Error(
              "At least 2 players are required"
            );
          }


          if (
            !room.players.every(
              player => player.ready
            )
          ) {
            throw new Error(
              "All players must be ready"
            );
          }


          startGameForRoom(io, room);

        } catch (error) {

          socket.emit(
            "error:message",
            {
              message:
                error.message ||
                "Unable to start game"
            }
          );
        }
      }
    );


    /*
      INVITE PLAYER
    */
    socket.on(
      "room:invite",
      ({ roomId, targetUserId }) => {

        try {

          const room =
            store.rooms.get(
              normalizeRoomId(roomId)
            );


          if (!room) {
            throw new Error(
              "Room not found"
            );
          }


          if (
            room.status !== "WAITING"
          ) {
            throw new Error(
              "Game already started"
            );
          }


          const isRoomMember =
            room.players.some(
              player =>
                String(player.userId) === userId
            );


          if (!isRoomMember) {
            throw new Error(
              "You are not a room member"
            );
          }


          if (
            room.players.length >=
            room.maxPlayers
          ) {
            throw new Error(
              "Room is full"
            );
          }


          const targetId =
            String(targetUserId);


          const target =
            store.users.get(targetId);


          if (
            !target ||
            !store.onlineSockets.has(targetId)
          ) {
            throw new Error(
              "Player is offline"
            );
          }


          const alreadyJoined =
            room.players.some(
              player =>
                String(player.userId) === targetId
            );


          if (alreadyJoined) {
            throw new Error(
              "Player is already in the room"
            );
          }


          const inviteId = id();


          store.roomInvites.set(
            inviteId,
            {
              inviteId,

              roomId: room.roomId,

              fromUserId: userId,

              toUserId: targetId,

              expiresAt:
                Date.now() + 120000
            }
          );


          const inviter =
            store.users.get(userId);


          for (
            const socketId of socketsFor(targetId)
          ) {
            io.to(socketId).emit(
              "room:invite",
              {
                inviteId,

                roomId: room.roomId,

                roomName: room.roomName,

                inviter: {
                  userId,

                  uid: inviter?.uid,

                  username:
                    inviter?.username
                }
              }
            );
          }


          socket.emit(
            "room:invite:response",
            {
              inviteId,

              targetUserId: targetId,

              accepted: null,

              message:
                `Invitation sent to ${target.username}.`
            }
          );

        } catch (error) {

          socket.emit(
            "error:message",
            {
              message:
                error.message ||
                "Unable to send invitation"
            }
          );
        }
      }
    );


    /*
      ACCEPT INVITATION
    */
    socket.on(
      "room:invite:accept",
      ({ inviteId }) => {

        try {

          const invitation =
            store.roomInvites.get(
              String(inviteId)
            );


          if (
            !invitation ||
            String(invitation.toUserId) !==
              userId
          ) {
            throw new Error(
              "Invitation is no longer valid"
            );
          }


          if (
            invitation.expiresAt < Date.now()
          ) {

            store.roomInvites.delete(
              String(inviteId)
            );

            throw new Error(
              "Invitation expired"
            );
          }


          const room =
            store.rooms.get(
              invitation.roomId
            );


          if (!room) {
            throw new Error(
              "Room no longer exists"
            );
          }


          if (
            room.status !== "WAITING"
          ) {
            throw new Error(
              "Game already started"
            );
          }


          if (
            room.players.length >=
            room.maxPlayers
          ) {
            throw new Error(
              "Room is full"
            );
          }


          const user =
            store.users.get(userId);


          if (!user) {
            throw new Error(
              "User not found"
            );
          }


          const alreadyJoined =
            room.players.some(
              player =>
                String(player.userId) === userId
            );


          if (!alreadyJoined) {

            room.players.push({
              userId,

              uid: user.uid,

              username:
                user.username,

              ready: false
            });
          }


          store.roomInvites.delete(
            String(inviteId)
          );


          socket.join(
            room.roomId
          );


          emitRoom(io, room);


          socket.emit(
            "room:joined",
            {
              inviteId:
                String(inviteId),

              room:
                publicRoom(room)
            }
          );


          for (
            const socketId of socketsFor(
              invitation.fromUserId
            )
          ) {

            io.to(socketId).emit(
              "room:invite:response",
              {
                inviteId:
                  String(inviteId),

                targetUserId:
                  userId,

                accepted: true,

                message:
                  `${user.username} accepted your room invitation.`
              }
            );
          }

        } catch (error) {

          socket.emit(
            "error:message",
            {
              message:
                error.message ||
                "Unable to accept invitation"
            }
          );
        }
      }
    );


    /*
      REJECT INVITATION
    */
    socket.on(
      "room:invite:reject",
      ({ inviteId }) => {

        const invitation =
          store.roomInvites.get(
            String(inviteId)
          );


        if (
          !invitation ||
          String(invitation.toUserId) !==
            userId
        ) {
          return;
        }


        store.roomInvites.delete(
          String(inviteId)
        );


        const user =
          store.users.get(userId);


        for (
          const socketId of socketsFor(
            invitation.fromUserId
          )
        ) {

          io.to(socketId).emit(
            "room:invite:response",
            {
              inviteId:
                invitation.inviteId,

              targetUserId:
                userId,

              accepted: false,

              message:
                `${user?.username || "Player"} rejected your room invitation.`
            }
          );
        }
      }
    );


    /*
      REMATCH
    */
    socket.on(
      "room:rematch",
      ({ roomId }) => {

        try {

          const room =
            store.rooms.get(
              normalizeRoomId(roomId)
            );


          if (!room) {
            throw new Error(
              "Room not found"
            );
          }


          if (
            room.status !== "FINISHED" &&
            room.status !== "PLAYING"
          ) {
            throw new Error(
              "Rematch is not available yet"
            );
          }


          room.rematchReady =
            room.rematchReady ||
            new Set();


          room.rematchReady.add(
            userId
          );


          io.to(room.roomId).emit(
            "room:rematch:update",
            {
              count:
                room.rematchReady.size,

              total:
                room.players.length
            }
          );


          if (
            room.rematchReady.size ===
            room.players.length
          ) {

            room.rematchReady.clear();


            room.status = "WAITING";


            for (
              const player of room.players
            ) {
              player.ready = true;
            }


            startGameForRoom(
              io,
              room
            );
          }

        } catch (error) {

          socket.emit(
            "error:message",
            {
              message:
                error.message ||
                "Unable to start rematch"
            }
          );
        }
      }
    );


    /*
      JOIN GAME SOCKET ROOM
    */
    socket.on(
      "game:join",
      ({ gameId }) => {

        const game =
          store.games.get(gameId);


        if (!game) return;


        const isPlayer =
          game.players.some(
            player =>
              String(player.userId) === userId
          );


        if (!isPlayer) return;


        socket.join(
          game.roomId
        );


        socket.emit(
          "game:state",
          {
            game:
              publicGame(
                game,
                userId
              )
          }
        );
      }
    );


    /*
      SUBMIT BINGO BOARD
    */
    socket.on(
      "game:boardSubmit",
      ({ gameId, board }) => {

        try {

          const game =
            store.games.get(gameId);


          if (!game) {
            throw new Error(
              "Game not found"
            );
          }


          submitBoard(
            game,
            userId,
            board
          );


          emitGameToRoom(
            io,
            "game:state",
            game
          );

        } catch (error) {

          socket.emit(
            "error:message",
            {
              message:
                error.message ||
                "Unable to submit board"
            }
          );
        }
      }
    );


    /*
      CALL NUMBER
    */
    socket.on(
      "game:numberCall",
      ({ gameId, number }) => {

        try {

          const game =
            store.games.get(gameId);


          if (!game) {
            throw new Error(
              "Game not found"
            );
          }


          const result =
            callNumber(
              game,
              userId,
              Number(number)
            );


          if (
            result.game.status ===
            "FINISHED"
          ) {

            finishToHistory(
              result.game
            );


            const room =
              store.rooms.get(
                result.game.roomId
              );


            if (room) {
              room.status =
                "FINISHED";
            }
          }


          emitGameToRoom(
            io,
            "game:move",
            result.game,
            {
              actor:
                result.actor,

              number:
                result.number,

              resultEvent:
                result.resultEvent
            }
          );

        } catch (error) {

          socket.emit(
            "error:message",
            {
              message:
                error.message ||
                "Unable to call number"
            }
          );
        }
      }
    );


    /*
      RECONNECT TO GAME
    */
    socket.on(
      "game:reconnect",
      ({ gameId }) => {

        const game =
          store.games.get(gameId);


        if (!game) return;


        const isPlayer =
          game.players.some(
            player =>
              String(player.userId) === userId
          );


        if (!isPlayer) return;


        socket.join(
          game.roomId
        );


        socket.emit(
          "game:state",
          {
            game:
              publicGame(
                game,
                userId
              )
          }
        );
      }
    );


    /*
      DISCONNECT
    */
    socket.on(
      "disconnect",
      () => {

        const userSockets =
          store.onlineSockets.get(
            userId
          );


        if (userSockets) {

          userSockets.delete(
            socket.id
          );


          if (
            userSockets.size === 0
          ) {
            store.onlineSockets.delete(
              userId
            );
          }
        }


        emitPresence(io);
      }
    );

  });
}