// Connect Four-Flush
const{rnd}=require('../util'),{finish,turnBot,myTurnDefault}=require('./common');
function winner(b){const at=(r,c)=>r>=0&&r<6&&c>=0&&c<7?b[r*7+c]:undefined;
 for(let r=0;r<6;r++)for(let c=0;c<7;c++){const v=at(r,c);if(v==null)continue;
  for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]])if([1,2,3].every(k=>at(r+dr*k,c+dc*k)===v))return v}
 return b.every(x=>x!=null)?'draw':null}
function drop(b,col){for(let r=5;r>=0;r--)if(b[r*7+col]==null)return r*7+col;return -1}
function evalB(b,p){let s=0;for(let r=0;r<6;r++)if(b[r*7+3]===p)s+=3;else if(b[r*7+3]===1-p)s-=3;
 for(let r=0;r<6;r++)for(let c=0;c<7;c++)for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){const er=r+dr*3,ec=c+dc*3;if(er<0||er>5||ec<0||ec>6)continue;
  let mp=0,mo=0;for(let k=0;k<4;k++){const v=b[(r+dr*k)*7+c+dc*k];if(v===p)mp++;else if(v===1-p)mo++}
  if(!mo)s+=[0,1,5,40,0][mp];if(!mp)s-=[0,1,6,50,0][mo]}return s}
const ORD=[3,2,4,1,5,0,6];
function nega(b,p,d,al,be){const w=winner(b);if(w==='draw')return 0;if(w!=null)return w===p?1e5+d:-1e5-d;if(!d)return evalB(b,p);
 let best=-Infinity;for(const col of ORD){const i=drop(b,col);if(i<0)continue;b[i]=p;const s=-nega(b,1-p,d-1,-be,-al);b[i]=null;
  if(s>best)best=s;if(best>al)al=best;if(al>=be)break}return best}
function pick(g,me,hard){const b=g.board,cols=ORD.filter(c=>drop(b,c)>=0);
 for(const c of cols){const i=drop(b,c);b[i]=me;const w=winner(b);b[i]=null;if(w===me)return c}
 if(!hard){if(Math.random()<.5)for(const c of cols){const i=drop(b,c);b[i]=1-me;const w=winner(b);b[i]=null;if(w===1-me)return c}return rnd(cols)}
 let best=-Infinity,mv=cols[0];for(const c of cols){const i=drop(b,c);b[i]=me;const s=-nega(b,1-me,5,-Infinity,Infinity);b[i]=null;if(s>best){best=s;mv=c}}return mv}
module.exports={
 init(g){g.board=Array(42).fill(null)},
 move(g,me,b){if(g.turn!==me)return'Not your turn';const col=Number(b.pos);if(!(Number.isInteger(col)&&col>=0&&col<7))return'Bad column';
  const i=drop(g.board,col);if(i<0)return'Column full';g.board[i]=me;g.last=i;
  const w=winner(g.board);if(w!=null)finish(g,w==='draw'?'draw':g.players[w]);else g.turn=1-me;return null},
 bot:turnBot(pick),myTurn:myTurnDefault,
 view(g,o){o.board=g.board}};
