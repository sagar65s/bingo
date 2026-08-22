import { id } from '../utils/ids.js';
import { GAME_CONFIG,getGameRules } from '../config/gameConfig.js';
import { validateBoard,countCompletedLines } from '../utils/board.js';

export function makeGame(room){
  const rules=getGameRules(room.players.length);
  return {
    gameId:id(),roomId:room.roomId,playerCount:room.players.length,
    boardSize:rules.boardSize,requiredLines:rules.requiredLines,status:'BOARD_SETUP',
    currentTurn:room.players[0].userId,turnNumber:0,calledNumbers:[],
    players:room.players.map(p=>({
      userId:p.userId,uid:p.uid,username:p.username,board:[],completedLines:0,
      completedLineKeys:[],rank:null,points:0,status:'PLAYING',ready:false
    })),startedAt:new Date().toISOString(),endedAt:null
  };
}

export function submitBoard(game,userId,rawBoard){
  if(game.status!=='BOARD_SETUP') throw new Error('Board setup is already complete');
  const player=game.players.find(p=>String(p.userId)===String(userId));
  if(!player) throw new Error('Player is not in this game');
  if(player.ready) throw new Error('Your board is already submitted');
  const validation=validateBoard(rawBoard,game.boardSize);
  if(!validation.valid) throw new Error(validation.message);
  player.board=rawBoard.map(row=>row.map(value=>({value,marked:false})));
  player.ready=true;
  if(game.players.every(p=>p.ready)){
    game.status='PLAYING';
    game.currentTurn=String(game.players[0].userId);
  }
  return game;
}

function activePlayers(game){return game.players.filter(p=>p.status==='PLAYING');}
function finishWithDraw(game,drawPlayers){
  for(const p of game.players){
    p.status='DRAW';
    p.rank=null;
    p.points=GAME_CONFIG.DRAW_POINTS;
  }
  game.status='FINISHED';
  game.endedAt=new Date().toISOString();
  return {type:'DRAW',players:drawPlayers.map(p=>p.username)};
}
function finishWithWinner(game,winner){
  winner.rank=1;
  winner.status='RANKED';
  winner.points=GAME_CONFIG.SCORE_BY_RANK[1] ?? 100;
  for(const p of game.players){
    if(p===winner) continue;
    p.rank=null;
    p.status='OUT';
    p.points=GAME_CONFIG.OUT_POINTS;
  }
  game.status='FINISHED';
  game.endedAt=new Date().toISOString();
  return {type:'WIN',username:winner.username,rank:1};
}

export function callNumber(game,userId,number){
  if(game.status!=='PLAYING') throw new Error('Game is not accepting moves');
  if(String(game.currentTurn)!==String(userId)) throw new Error('It is not your turn');
  if(!Number.isInteger(number)||number<1||number>game.boardSize*game.boardSize) throw new Error('Invalid number');
  if(game.calledNumbers.includes(number)) throw new Error('Number has already been called');

  const actor=game.players.find(p=>String(p.userId)===String(userId));
  game.calledNumbers.push(number);
  game.turnNumber+=1;

  for(const p of game.players){
    if(p.status!=='PLAYING') continue;
    for(const row of p.board) for(const cell of row) if(Number(cell.value)===number) cell.marked=true;
  }

  const newlyCompleted=[];
  for(const p of activePlayers(game)){
    const lines=countCompletedLines(p.board);
    const keys=lines.map(x=>`${x.type}:${x.index}`);
    const newKeys=keys.filter(k=>!p.completedLineKeys.includes(k));
    if(newKeys.length){
      p.completedLineKeys.push(...newKeys);
      p.completedLines=p.completedLineKeys.length;
      newlyCompleted.push({player:p,newKeys});
    }
  }

  const winnersThisMove=newlyCompleted
    .filter(x=>x.player.completedLines>=game.requiredLines)
    .map(x=>x.player);

  let resultEvent=null;
  if(winnersThisMove.length>1){
    resultEvent=finishWithDraw(game,winnersThisMove);
  }else if(winnersThisMove.length===1){
    resultEvent=finishWithWinner(game,winnersThisMove[0]);
  }

  if(game.status!=='FINISHED'){
    const players=activePlayers(game);
    const idx=players.findIndex(p=>String(p.userId)===String(userId));
    game.currentTurn=players[(idx+1+players.length)%players.length]?.userId || players[0]?.userId;
  }

  return {game,actor:actor?.username||'Player',number,resultEvent,newlyCompleted};
}
