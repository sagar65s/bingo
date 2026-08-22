export const GAME_CONFIG = Object.freeze({
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 5,
  BOARD_SIZE_BY_PLAYERS: Object.freeze({2:5,3:6,4:7,5:8}),
  REQUIRED_LINES_BY_PLAYERS: Object.freeze({2:5,3:6,4:7,5:8}),
  // Final scoring rule: only the winner gets points.
  SCORE_BY_RANK: Object.freeze({1:100}),
  DRAW_POINTS: 0,
  OUT_POINTS: 0
});

export function getGameRules(playerCount){
  const n=Number(playerCount);
  const boardSize=GAME_CONFIG.BOARD_SIZE_BY_PLAYERS[n];
  if(!boardSize) throw new Error('Only 2 to 5 players are supported');
  return {playerCount:n,boardSize,requiredLines:GAME_CONFIG.REQUIRED_LINES_BY_PLAYERS[n]};
}
