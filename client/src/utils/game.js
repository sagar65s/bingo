export const BOARD_SIZE = {2:5,3:6,4:7,5:8,6:9,7:10};
export const REQUIRED_LINES = {2:5,3:6,4:7,5:8,6:9,7:10};

export function makeDemoBoard(size) {
  const values=[];
  for(let i=1;i<=size*size;i++) values.push(i);
  return Array.from({length:size},(_,r)=>values.slice(r*size,(r+1)*size));
}
