export function createEmptyBoard(size){return Array.from({length:size},()=>Array(size).fill(null));}
export function flattenBoard(board){return board.flat();}
export function validateBoard(board,size){
 const max=size*size;
 if(!Array.isArray(board)||board.length!==size)return{valid:false,message:"Invalid board size"};
 const seen=new Set();
 for(const row of board){
  if(!Array.isArray(row)||row.length!==size)return{valid:false,message:"Invalid board rows"};
  for(const value of row){
   if(!Number.isInteger(value)||value<1||value>max)return{valid:false,message:`Board values must be between 1 and ${max}`};
   if(seen.has(value))return{valid:false,message:"Duplicate board values are not allowed"};
   seen.add(value);
  }
 }
 return{valid:true};
}
export function markNumber(board,number){return board.map(row=>row.map(cell=>cell&&cell.value===number?{...cell,marked:true}:cell));}
export function countCompletedLines(board){
 const size=board.length,lines=[];
 for(let r=0;r<size;r++)if(board[r].every(c=>c?.marked))lines.push({type:"row",index:r});
 for(let c=0;c<size;c++){let ok=true;for(let r=0;r<size;r++)if(!board[r]?.[c]?.marked)ok=false;if(ok)lines.push({type:"column",index:c});}
 let d1=true,d2=true;for(let i=0;i<size;i++){if(!board[i]?.[i]?.marked)d1=false;if(!board[i]?.[size-1-i]?.marked)d2=false;}
 if(d1)lines.push({type:"diagonal",index:"main"});if(d2)lines.push({type:"diagonal",index:"anti"});return lines;
}
