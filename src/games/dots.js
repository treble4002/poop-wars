// Stall Wars (dots & boxes, 5x5 dots = 4x4 stalls, 40 lines)
// line i<20: horizontal row r=i/4|0 col i%4 ; i>=20: vertical j=i-20 row j/5|0 col j%5
const{rnd}=require('../util'),{finish,turnBot,myTurnDefault}=require('./common');
const boxSides=k=>{const r=k>>2,c=k&3;return[r*4+c,(r+1)*4+c,20+r*5+c,21+r*5+c]};
const LINE_BOXES=Array.from({length:40},(_,i)=>[...Array(16).keys()].filter(k=>boxSides(k).includes(i)));
const sidesSet=(L,k)=>boxSides(k).filter(i=>L[i]!=null).length;
function giveaway(L,i){L=L.slice();L[i]=1;let n=0,more=true;while(more){more=false;for(let k=0;k<16;k++)if(sidesSet(L,k)===3){for(const s of boxSides(k))L[s]=1;n++;more=true}}return n}
function pick(g,me,hard){const L=g.lines,free=[...L.keys()].filter(i=>L[i]==null);
 const closing=free.filter(i=>LINE_BOXES[i].some(k=>sidesSet(L,k)===3));
 if(closing.length&&(hard||Math.random()<.6))return rnd(closing);
 if(!hard)return rnd(free);
 const safe=free.filter(i=>LINE_BOXES[i].every(k=>sidesSet(L,k)<2));if(safe.length)return rnd(safe);
 let best=1e9,mv=[];for(const i of free){const n=giveaway(L,i);if(n<best){best=n;mv=[i]}else if(n===best)mv.push(i)}return rnd(mv)}
module.exports={
 init(g){g.lines=Array(40).fill(null);g.boxes=Array(16).fill(null)},
 move(g,me,b){if(g.turn!==me)return'Not your turn';const i=Number(b.pos);if(!(Number.isInteger(i)&&i>=0&&i<40)||g.lines[i]!=null)return'Line taken';
  g.lines[i]=me;g.last=i;let got=false;
  for(const k of LINE_BOXES[i])if(g.boxes[k]==null&&sidesSet(g.lines,k)===4){g.boxes[k]=me;got=true}
  if(g.boxes.every(x=>x!=null)){const a=g.boxes.filter(x=>x===0).length;finish(g,a===8?'draw':a>8?g.players[0]:g.players[1])}else if(!got)g.turn=1-me;return null},
 bot:turnBot(pick),myTurn:myTurnDefault,
 view(g,o){o.lines=g.lines;o.boxes=g.boxes}};
