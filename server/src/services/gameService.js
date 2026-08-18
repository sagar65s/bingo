import { id } from "../utils/ids.js";
import { GAME_CONFIG, getGameRules } from "../config/gameConfig.js";
import { validateBoard, countCompletedLines } from "../utils/board.js";

export function makeGame(room) {
  const rules = getGameRules(room.players.length);
  return {
    gameId: id(),
    roomId: room.roomId,
    playerCount: room.players.length,
    boardSize: rules.boardSize,
    requiredLines: rules.requiredLines,
    status: "BOARD_SETUP",
    currentTurn: room.players[0].userId,
    turnNumber: 0,
    calledNumbers: [],
    players: room.players.map(p => ({
      userId:p.userId, uid:p.uid, username:p.username,
      board:[], completedLines:0, completedLineKeys:[],
      rank:null, points:0, status:"PLAYING", ready:false
    })),
    startedAt:new Date().toISOString(),
    endedAt:null
  };
}

export function submitBoard(game, userId, rawBoard) {
  const player = game.players.find(p => p.userId === userId);
  if (!player) throw new Error("Player is not in this game");
  const validation = validateBoard(rawBoard, game.boardSize);
  if (!validation.valid) throw new Error(validation.message);
  player.board = rawBoard.map(row => row.map(value => ({value, marked:false})));
  player.ready = true;
  if (game.players.every(p => p.ready)) game.status = "PLAYING";
  return game;
}

function activePlayers(game) {
  return game.players.filter(p => p.status === "PLAYING");
}

export function callNumber(game, userId, number) {
  if (game.status !== "PLAYING") throw new Error("Game is not accepting moves");
  if (game.currentTurn !== userId) throw new Error("It is not your turn");
  if (!Number.isInteger(number) || number < 1) throw new Error("Invalid number");
  if (game.calledNumbers.includes(number)) throw new Error("Number has already been called");

  const actor = game.players.find(p => p.userId === userId);
  game.calledNumbers.push(number);
  game.turnNumber += 1;

  // A called number marks the same number on EVERY board, including the caller.
  // This keeps the main board synchronized for both players.
  for (const p of game.players) {
    if (p.status !== "PLAYING") continue;
    for (const row of p.board) {
      for (const cell of row) {
        if (cell.value === number) cell.marked = true;
      }
    }
  }

  // Determine all state changes caused by this single move before ranking.
  const newlyCompleted = [];
  for (const p of game.players) {
    if (p.status !== "PLAYING") continue;
    const lines = countCompletedLines(p.board);
    const keys = lines.map(x => `${x.type}:${x.index}`);
    const newKeys = keys.filter(k => !p.completedLineKeys.includes(k));
    if (newKeys.length) {
      p.completedLineKeys.push(...newKeys);
      p.completedLines = p.completedLineKeys.length;
      newlyCompleted.push({player:p, newKeys});
    }
  }

  const winnersThisMove = newlyCompleted
    .filter(x => x.player.completedLines >= game.requiredLines)
    .map(x => x.player);

  let resultEvent = null;

  if (winnersThisMove.length > 1) {
    const drawIds = new Set(winnersThisMove.map(p => p.userId));
    for (const p of game.players) {
      if (drawIds.has(p.userId)) {
        p.status = "DRAW";
        p.points = GAME_CONFIG.DRAW_POINTS;
        p.rank = null;
      } else {
        p.status = "OUT";
        p.points = GAME_CONFIG.OUT_POINTS;
        p.rank = null;
      }
    }
    game.status = "FINISHED";
    resultEvent = {type:"DRAW", players:winnersThisMove.map(p=>p.username)};
  } else if (winnersThisMove.length === 1) {
    const winner = winnersThisMove[0];
    const alreadyRanked = game.players.filter(p => p.rank != null).length;
    winner.rank = alreadyRanked + 1;
    winner.points = GAME_CONFIG.SCORE_BY_RANK[winner.rank] ?? 0;
    winner.status = "RANKED";

    const stillPlaying = activePlayers(game);
    if (stillPlaying.length <= 1) {
      if (stillPlaying.length === 1) {
        const out = stillPlaying[0];
        out.status = "OUT";
        out.points = GAME_CONFIG.OUT_POINTS;
      }
      game.status = "FINISHED";
    }
    resultEvent = {type:"RANKED", username:winner.username, rank:winner.rank};
  }

  if (game.status !== "FINISHED") {
    const players = activePlayers(game);
    const idx = players.findIndex(p => p.userId === userId);
    game.currentTurn = players[(idx + 1) % players.length]?.userId || players[0]?.userId;
  } else {
    const unranked = game.players.filter(p => p.status === "PLAYING");
    if (unranked.length === 1) {
      unranked[0].status = "OUT";
      unranked[0].points = GAME_CONFIG.OUT_POINTS;
    }
    game.endedAt = new Date().toISOString();
  }

  return {game, actor:actor.username, number, newlyCompleted, resultEvent};
}
