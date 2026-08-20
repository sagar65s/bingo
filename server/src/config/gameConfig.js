export const GAME_CONFIG = Object.freeze({
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 7,
  BOARD_SIZE_BY_PLAYERS: Object.freeze({2:5,3:6,4:7,5:8,6:9,7:10}),
  REQUIRED_LINES_BY_PLAYERS: Object.freeze({2:5,3:6,4:7,5:8,6:9,7:10}),
  SCORE_BY_RANK: Object.freeze({1:1000,2:800,3:600,4:400,5:300,6:200,7:100}),
  DRAW_POINTS: 0,
  OUT_POINTS: 0,
  MAX_TURN_HISTORY: 500
});

export function getGameRules(playerCount) {
  const n = Number(playerCount);
  if (!GAME_CONFIG.BOARD_SIZE_BY_PLAYERS[n]) throw new Error("Unsupported player count");
  return {
    playerCount: n,
    boardSize: GAME_CONFIG.BOARD_SIZE_BY_PLAYERS[n],
    requiredLines: GAME_CONFIG.REQUIRED_LINES_BY_PLAYERS[n]
  };
}
