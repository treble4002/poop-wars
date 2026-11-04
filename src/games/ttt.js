// Tic-Tac-Toilet
const{rnd}=require('../util'),{finish,turnBot,myTurnDefault}=require('./common');
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(b){for(const[a,c,d]of LINES)if(b[a]!=null&&b[a]===b[c]&&b[a]===b[d])return b[a];return b.every(x=>x!=null)?'draw':null}
function neg(b,p){const w=winner(b);if(w==='draw')return 0;if(w!=null)return w===p?1:-1;let best=-2;
 for(let i=0;i<9;i++)if(b[i]==null){b[i]=p;const s=-neg(b,1-p);b[i]=null;if(s>best)best=s}return best}
function pick(g,me,hard){const b=g.board,empty=[...b.keys()].filter(i=>b[i]==null);
 for(const i of empty){b[i]=me;const w=winner(b);b[i]=null;if(w===me)return i}
 if(!hard)return rnd(empty);
 let best=-3,mv=[];for(const i of empty){b[i]=me;const s=-neg(b,1-me);b[i]=null;if(s>best){best=s;mv=[i]}else if(s===best)mv.push(i)}return rnd(mv)}
module.exports={
 init(g){g.board=Array(9).fill(null)},
 move(g,me,b){if(g.turn!==me)return'Not your turn';const i=Number(b.pos);if(!(Number.isInteger(i)&&i>=0&&i<9)||g.board[i]!=null)return'Bad square';
  g.board[i]=me;g.last=i;const w=winner(g.board);if(w!=null)finish(g,w==='draw'?'draw':g.players[w]);else g.turn=1-me;return null},
 bot:turnBot(pick),myTurn:myTurnDefault,
 view(g,o){o.board=g.board}};
