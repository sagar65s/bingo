import mongoose from 'mongoose';
import User from '../models/User.js';
import { roomCode } from '../utils/ids.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { store } from '../store/memoryStore.js';
import { makeGame } from '../services/gameService.js';

const cleanId = v => String(v ?? '').replace(/\D/g, '').slice(0, 6);
const key = v => String(v ?? '');

// Always resolve the authenticated user from the current JWT subject.
// This prevents a previous account's user object from becoming the host
// when another account creates a new room.
async function getCurrentUser(req) {
  const authId = key(req.auth?.sub);
  if (!authId) return null;

  let user = store.users.get(authId);
  if (user) return user;

  if (mongoose.connection.readyState === 1) {
    try {
      user = await User.findById(authId).lean();
      if (user) store.users.set(authId, user);
    } catch {
      return null;
    }
  }
  return user || null;
}

export async function createRoom(req, res) {
  const count = Number(req.body?.maxPlayers);
  if (!Number.isInteger(count) || count < 2 || count > 5) {
    return res.status(400).json({ message: 'Choose between 2 and 5 players' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'User not found. Please log in again.' });
  }

  // The creator of THIS room is ALWAYS the host of THIS room.
  // Never reuse hostId from another room.
  const creatorId = key(req.auth.sub);
  let roomId = roomCode();
  while (store.rooms.has(roomId)) roomId = roomCode();

  const room = {
    roomId,
    roomName: String(req.body?.roomName || 'Friends Room').trim().slice(0, 50) || 'Friends Room',
    passwordHash: await hashPassword(String(req.body?.password || '')),
    hostId: creatorId,
    maxPlayers: count,
    status: 'WAITING',
    players: [{
      userId: creatorId,
      uid: user.uid,
      username: user.username,
      ready: false
    }],
    gameId: null,
    rematchReady: new Set()
  };

  store.rooms.set(roomId, room);
  return res.status(201).json({ room: publicRoom(room) });
}

export async function joinRoom(req, res) {
  const roomId = cleanId(req.body?.roomId);
  const password = String(req.body?.password ?? '');

  if (!/^\d{6}$/.test(roomId)) {
    return res.status(400).json({ message: 'Room ID must contain exactly 6 numbers' });
  }

  const room = store.rooms.get(roomId);
  if (!room) return res.status(404).json({ message: 'Room not found' });
  if (room.status !== 'WAITING') return res.status(409).json({ message: 'This game has already started' });

  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'User not found. Please log in again.' });

  const userId = key(req.auth.sub);
  if (room.players.some(p => key(p.userId) === userId)) {
    return res.json({ room: publicRoom(room), alreadyJoined: true });
  }

  if (room.players.length >= room.maxPlayers) {
    return res.status(409).json({ message: 'Room is full' });
  }

  if (!await comparePassword(password, room.passwordHash)) {
    return res.status(401).json({ message: 'Incorrect room password' });
  }

  room.players.push({
    userId,
    uid: user.uid,
    username: user.username,
    ready: false
  });

  return res.json({ room: publicRoom(room) });
}

export function publicRoom(room) {
  // Keep hostId strictly tied to a current member. If an old/stale host id
  // somehow exists, elect the first remaining member as the new host.
  const members = room.players || [];
  let hostId = key(room.hostId);
  if (!members.some(p => key(p.userId) === hostId)) {
    hostId = members.length ? key(members[0].userId) : null;
    room.hostId = hostId;
  }

  return {
    roomId: room.roomId,
    roomName: room.roomName,
    hostId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    gameId: room.gameId || null,
    players: members.map(p => ({
      userId: key(p.userId),
      uid: p.uid,
      username: p.username,
      ready: Boolean(p.ready)
    }))
  };
}

export function startRoom(room) {
  if (room.players.length < 2) throw new Error('At least 2 players are required');
  if (!room.players.every(p => p.ready)) throw new Error('Every player must be ready before the host starts the match');
  if (room.status !== 'WAITING') throw new Error('Room cannot be started now');

  // Re-validate the host immediately before starting.
  if (!room.players.some(p => key(p.userId) === key(room.hostId))) {
    room.hostId = key(room.players[0]?.userId);
  }

  room.status = 'PLAYING';
  room.rematchReady = new Set();
  const game = makeGame(room);
  store.games.set(game.gameId, game);
  room.gameId = game.gameId;
  return game;
}
