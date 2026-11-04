// Sink the Stink (8x8 battleship, ships 4/3/3/2)
const{rnd}=require('../util'),{finish,myTurnDefault}=require('./common');
const SHIPS=[4,3,3,2];
function validShips(s){if(!Array.isArray(s)||s.length!==4)return false;const seen=new Set();
 for(let k=0;k<4;k++){const c=s[k];if(!Array.isArray(c)||c.length!==SHIPS[k])return false;
  if(!c.every(x=>Number.isInteger(x)&&x>=0&&x<64&&!seen.has(x)))return false;c.forEach(x=>seen.add(x));
  const t=c.slice().sort((a,b)=>a-b),row=t.every(x=>(x>>3)===(t[0]>>3))&&t.every((x,i)=>x===t[0]+i),col=t.every((x,i)=>x===t[0]+8*i);if(!row&&!col)return false}return true}
function randomShips(){for(;;){const used=new Set(),out=[];let ok=true;
 for(const n of SHIPS){let placed=false;for(let t=0;t<100&&!placed;t++){const h=Math.random()<.5,r=Math.random()*(h?8:9-n)|0,c=Math.random()*(h?9-n:8)|0;
  const cells=Array.from({length:n},(_,i)=>h?r*8+c+i:(r+i)*8+c);if(cells.every(x=>!used.has(x))){cells.forEach(x=>used.add(x));out.push(cells);placed=true}}
  if(!placed){ok=false;break}}if(ok)return out}}
const sunkShips=(ships,shots)=>ships.map((c,k)=>c.every(x=>shots[x]==='hit')?k:-1).filter(k=>k>=0);
function pick(g,me,hard){const shots=g.shots[me],unknown=[...Array(64).keys()].filter(x=>!shots[x]);if(!hard)return rnd(unknown);
 const opp=g.ships[1-me],sunkCells=new Set(sunkShips(opp,shots).flatMap(k=>opp[k]));
 const open=Object.keys(shots).map(Number).filter(x=>shots[x]==='hit'&&!sunkCells.has(x));
 const nb=x=>[[x-8,0],[x+8,0],[x-1,1],[x+1,1]].filter(([y,h])=>y>=0&&y<64&&(!h||(y>>3)===(x>>3)));
 if(open.length){const pref=[],any=[];for(const x of open)for(const[y]of nb(x)){if(shots[y])continue;any.push(y);const d=y-x,back=x-d;if(open.includes(back))pref.push(y)}
  if(pref.length)return rnd(pref);if(any.length)return rnd(any)}
 const par=unknown.filter(x=>((x>>3)+(x&7))%2===0);return rnd(par.length?par:unknown)}
module.exports={
 init(g){g.phase='setup';g.ships=[null,null];g.shots=[{},{}]},
 move(g,me,b){const pid=g.players[me];
  if(g.phase==='setup'){if(g.ships[me])return'Already placed';const s=b.ships==='random'?randomShips():b.ships;if(!validShips(s))return'Bad ship placement';
   g.ships[me]=s;if(g.ships[0]&&g.ships[1])g.phase='play';return null}
  if(g.turn!==me)return'Not your turn';
  const x=Number(b.pos);if(!(Number.isInteger(x)&&x>=0&&x<64))return'Bad cell';if(g.shots[me][x])return'Already shot there';
  const opp=g.ships[1-me],hitK=opp.findIndex(c=>c.includes(x));g.shots[me][x]=hitK>=0?'hit':'miss';
  const sunk=hitK>=0&&opp[hitK].every(y=>g.shots[me][y]==='hit');g.lastShot={by:me,pos:x,result:hitK<0?'miss':sunk?'sunk':'hit',ship:sunk?hitK:null};
  if(opp.flat().every(y=>g.shots[me][y]==='hit'))finish(g,pid);else g.turn=1-me;return null},
 bot(g,bi,hard){if(g.phase==='setup')return g.ships[bi]?null:{ships:'random'};return g.turn!==bi?null:{pos:pick(g,bi,hard)}},
 myTurn(g,me){if(g.status!=='active')return false;return g.phase==='setup'?!g.ships[me]:g.turn===me},
 view(g,o,me,uid,done){o.phase=g.phase;o.placed=[!!g.ships[0],!!g.ships[1]];o.myShips=g.ships[me];o.myShots=g.shots[me];o.theirShots=g.shots[1-me];o.lastShot=g.lastShot;
  const opp=g.ships[1-me];o.sunkTheirs=opp?sunkShips(opp,g.shots[me]).map(k=>({k,cells:opp[k]})):[];if(done)o.theirShips=opp}};
