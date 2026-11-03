// Poop Wars server. Run: node server.js  (PORT env; DATABASE_URL env = Postgres, else data.json)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3737, DB=path.join(__dirname,'data.json');
let db={users:{},circles:{},games:{}};
let pool=null,saving=Promise.resolve();
if(process.env.DATABASE_URL){const{Pool}=require('pg');
 pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false}})}
else{try{db=JSON.parse(fs.readFileSync(DB))}catch(e){}}
const save=()=>{if(!pool)return fs.writeFileSync(DB,JSON.stringify(db));
 const snap=JSON.stringify(db);saving=saving.then(()=>pool.query('INSERT INTO pw_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=$1',[snap])).catch(e=>console.error('save failed',e))};
const id=(n=8)=>crypto.randomBytes(n).toString('hex');
const code=()=>Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random()*32|0]).join('');
const send=(res,s,o)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const rnd=a=>a[Math.random()*a.length|0];
const BOT='bot', TYPES=['ttt','c4','follow','dots','sink','hang'];
function ensureBot(){db.users[BOT]={id:BOT,name:'Plunger Bot 🪠',token:'bot-'+id(16),circles:[]}}

// ---------- Tic-Tac-Toilet ----------
const TTT_LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function tttWinner(b){for(const[a,c,d]of TTT_LINES)if(b[a]!=null&&b[a]===b[c]&&b[a]===b[d])return b[a];return b.every(x=>x!=null)?'draw':null}
function tttNeg(b,p){const w=tttWinner(b);if(w==='draw')return 0;if(w!=null)return w===p?1:-1;let best=-2;
 for(let i=0;i<9;i++)if(b[i]==null){b[i]=p;const s=-tttNeg(b,1-p);b[i]=null;if(s>best)best=s}return best}
function tttBot(g,me,hard){const b=g.board,empty=[...b.keys()].filter(i=>b[i]==null);
 for(const i of empty){b[i]=me;const w=tttWinner(b);b[i]=null;if(w===me)return i}
 if(!hard)return rnd(empty);
 let best=-3,mv=[];for(const i of empty){b[i]=me;const s=-tttNeg(b,1-me);b[i]=null;if(s>best){best=s;mv=[i]}else if(s===best)mv.push(i)}return rnd(mv)}

// ---------- Connect Four-Flush ----------
function c4Winner(b){const g=(r,c)=>r>=0&&r<6&&c>=0&&c<7?b[r*7+c]:undefined;
 for(let r=0;r<6;r++)for(let c=0;c<7;c++){const v=g(r,c);if(v==null)continue;
  for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]])if([1,2,3].every(k=>g(r+dr*k,c+dc*k)===v))return v}
 return b.every(x=>x!=null)?'draw':null}
function c4Drop(b,col){for(let r=5;r>=0;r--)if(b[r*7+col]==null)return r*7+col;return -1}
function c4Eval(b,p){let s=0;for(let r=0;r<6;r++)if(b[r*7+3]===p)s+=3;else if(b[r*7+3]===1-p)s-=3;
 for(let r=0;r<6;r++)for(let c=0;c<7;c++)for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){const er=r+dr*3,ec=c+dc*3;if(er<0||er>5||ec<0||ec>6)continue;
  let mp=0,mo=0;for(let k=0;k<4;k++){const v=b[(r+dr*k)*7+c+dc*k];if(v===p)mp++;else if(v===1-p)mo++}
  if(!mo)s+=[0,1,5,40,0][mp];if(!mp)s-=[0,1,6,50,0][mo]}return s}
const C4ORD=[3,2,4,1,5,0,6];
function c4Nega(b,p,d,al,be){const w=c4Winner(b);if(w==='draw')return 0;if(w!=null)return w===p?1e5+d:-1e5-d;if(!d)return c4Eval(b,p);
 let best=-Infinity;for(const col of C4ORD){const i=c4Drop(b,col);if(i<0)continue;b[i]=p;const s=-c4Nega(b,1-p,d-1,-be,-al);b[i]=null;
  if(s>best)best=s;if(best>al)al=best;if(al>=be)break}return best}
function c4Bot(g,me,hard){const b=g.board,cols=C4ORD.filter(c=>c4Drop(b,c)>=0);
 for(const c of cols){const i=c4Drop(b,c);b[i]=me;const w=c4Winner(b);b[i]=null;if(w===me)return c}
 if(!hard){if(Math.random()<.5)for(const c of cols){const i=c4Drop(b,c);b[i]=1-me;const w=c4Winner(b);b[i]=null;if(w===1-me)return c}return rnd(cols)}
 let best=-Infinity,mv=cols[0];for(const c of cols){const i=c4Drop(b,c);b[i]=me;const s=-c4Nega(b,1-me,5,-Infinity,Infinity);b[i]=null;if(s>best){best=s;mv=c}}return mv}

// ---------- Stall Wars (dots & boxes, 5x5 dots = 4x4 stalls, 40 lines) ----------
// line i<20: horizontal row r=i/4|0 col i%4 ; i>=20: vertical j=i-20 row j/5|0 col j%5
const boxSides=k=>{const r=k>>2,c=k&3;return[r*4+c,(r+1)*4+c,20+r*5+c,21+r*5+c]};
const LINE_BOXES=Array.from({length:40},(_,i)=>[...Array(16).keys()].filter(k=>boxSides(k).includes(i)));
const sidesSet=(L,k)=>boxSides(k).filter(i=>L[i]!=null).length;
function giveaway(L,i){L=L.slice();L[i]=1;let n=0,more=true;while(more){more=false;for(let k=0;k<16;k++)if(sidesSet(L,k)===3){for(const s of boxSides(k))L[s]=1;n++;more=true}}return n}
function dotsBot(g,me,hard){const L=g.lines,free=[...L.keys()].filter(i=>L[i]==null);
 const closing=free.filter(i=>LINE_BOXES[i].some(k=>sidesSet(L,k)===3));
 if(closing.length&&(hard||Math.random()<.6))return rnd(closing);
 if(!hard)return rnd(free);
 const safe=free.filter(i=>LINE_BOXES[i].every(k=>sidesSet(L,k)<2));if(safe.length)return rnd(safe);
 let best=1e9,mv=[];for(const i of free){const n=giveaway(L,i);if(n<best){best=n;mv=[i]}else if(n===best)mv.push(i)}return rnd(mv)}

// ---------- Sink the Stink (8x8 battleship) ----------
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
function sinkBot(g,me,hard){const shots=g.shots[me],unknown=[...Array(64).keys()].filter(x=>!shots[x]);if(!hard)return rnd(unknown);
 const opp=g.ships[1-me],sunkCells=new Set(sunkShips(opp,shots).flatMap(k=>opp[k]));
 const open=Object.keys(shots).map(Number).filter(x=>shots[x]==='hit'&&!sunkCells.has(x));
 const nb=x=>[[x-8,0],[x+8,0],[x-1,1],[x+1,1]].filter(([y,h])=>y>=0&&y<64&&(!h||(y>>3)===(x>>3)));
 if(open.length){const pref=[],any=[];for(const x of open)for(const[y]of nb(x)){if(shots[y])continue;any.push(y);const d=y-x,back=x-d;if(open.includes(back))pref.push(y)}
  if(pref.length)return rnd(pref);if(any.length)return rnd(any)}
 const par=unknown.filter(x=>((x>>3)+(x&7))%2===0);return rnd(par.length?par:unknown)}

// ---------- Hang-Ten TP (hangman) ----------
const WORDS='PLUNGER BUBBLES TOWEL FAUCET SHOWER BATHTUB SOAP TOOTHBRUSH SPONGE MIRROR SLIPPERS PICKLE PENGUIN PIZZA NOODLE BANANA WAFFLE PUDDLE GIGGLE WOBBLE KAZOO JELLYBEAN MARSHMALLOW TORNADO VOLCANO NAPKIN HICCUP SNORKEL BURRITO CUPCAKE GOBLIN ZOMBIE JIGSAW KETCHUP DRAGON POPCORN TOILET FLUSH PORCELAIN LOOFAH SQUEEGEE RUBBER DUCKY BLANKET PAJAMAS TACO HAMSTER WALRUS'.split(' ');
const MAXMISS=7;
function hangState(g,i){const w=g.words[i],gs=g.guesses[i],miss=gs.filter(l=>!w.includes(l)).length,solved=[...w].every(l=>gs.includes(l));return{miss,solved,over:solved||miss>=MAXMISS}}
const hangScore=s=>s.solved?s.miss:MAXMISS+1;
const FREQ='EARIOTNSLCUDPMHGBFYWKVXZJQ';
function hangBot(g,me,hard){const gs=g.guesses[me],w=g.words[me];
 if(!hard){const opts=FREQ.split('').filter(l=>!gs.includes(l));return Math.random()<.5?opts[0]:rnd(opts.slice(0,12))}
 const wrong=gs.filter(l=>!w.includes(l)),pat=[...w].map(l=>gs.includes(l)?l:null);
 const cands=WORDS.filter(x=>x.length===w.length&&[...x].every((l,i)=>pat[i]?l===pat[i]:!gs.includes(l))&&!wrong.some(l=>x.includes(l)));
 const cnt={};for(const x of cands)for(const l of new Set(x))if(!gs.includes(l))cnt[l]=(cnt[l]||0)+1;
 const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];return best?best[0]:FREQ.split('').find(l=>!gs.includes(l))}

// ---------- shared game engine ----------
// ---------- Follow the Flush (4-pad memory race) ----------
const SEQMAX=40,followBetter=(a,b)=>a.len!==b.len?a.len>b.len:a.ms<b.ms;
function followBot(hard){const len=hard?11+(Math.random()*4|0):4+(Math.random()*3|0);let ms=0;
 for(let r=1;r<=len;r++)for(let k=0;k<r;k++)ms+=hard?280+Math.random()*180:420+Math.random()*260;return{len,ms:Math.round(ms)}}
function trackBest(g){if(g.type!=='follow'||g.players.includes(BOT))return;for(const p of g.players){const u=db.users[p],r=g.res[p];if(!r)continue;
 const up=o=>{if(!o.follow||followBetter(r,o.follow))o.follow={len:r.len,ms:r.ms}};up(u.best=u.best||{});
 if(g.circleId){u.circleBest=u.circleBest||{};up(u.circleBest[g.circleId]=u.circleBest[g.circleId]||{})}}}
function bump(o,type,k){for(const t of[type,'all']){o[t]=o[t]||{w:0,l:0,d:0};o[t][k]++}}
function finish(g,w){g.status='done';g.winner=w;trackBest(g);const vsBot=g.players.includes(BOT);
 for(const p of g.players){if(p===BOT)continue;const u=db.users[p],k=w==='draw'?'d':w===p?'w':'l';
  if(vsBot)bump(u.botStats=u.botStats||{},g.type,k);
  else{bump(u.stats=u.stats||{},g.type,k);if(g.circleId){u.circleStats=u.circleStats||{};bump(u.circleStats[g.circleId]=u.circleStats[g.circleId]||{},g.type,k)}}}}
function applyMove(g,me,b){const t=g.type,pid=g.players[me];
 if(g.status!=='active')return'Game over';
 if(t==='follow'){if(g.res[pid])return'Already played';
  if(b.start){if(pid!==BOT&&!g.started[pid])g.started[pid]=Date.now();return null}
  const len=Number(b.len),ms=Math.round(Number(b.ms));if(!(Number.isInteger(len)&&len>=0&&len<=SEQMAX))return'Bad length';
  if(pid!==BOT){if(!g.started[pid])return'Start first';if(len>0&&(!(ms>=len*(len+1)/2*80)||ms>Date.now()-g.started[pid]+2000))return'Suspicious time 🤨'}
  g.res[pid]={len,ms:len?ms:0};
  if(Object.keys(g.res).length===2){const[a,c]=g.players.map(p=>g.res[p]);finish(g,a.len===c.len&&a.ms===c.ms?'draw':followBetter(a,c)?g.players[0]:g.players[1])}return null}
 if(t==='hang'){const l=String(b.letter||'').toUpperCase();if(!/^[A-Z]$/.test(l))return'Pick a letter';if(hangState(g,me).over)return'Your round is over';
  if(g.guesses[me].includes(l))return'Already guessed';g.guesses[me].push(l);const s=[0,1].map(i=>hangState(g,i));
  if(s[0].over&&s[1].over){const a=hangScore(s[0]),c=hangScore(s[1]);finish(g,a===c?'draw':a<c?g.players[0]:g.players[1])}return null}
 if(t==='sink'&&g.phase==='setup'){if(g.ships[me])return'Already placed';const s=b.ships==='random'?randomShips():b.ships;if(!validShips(s))return'Bad ship placement';
  g.ships[me]=s;if(g.ships[0]&&g.ships[1])g.phase='play';return null}
 if(g.turn!==me)return'Not your turn';
 if(t==='ttt'){const i=Number(b.pos);if(!(Number.isInteger(i)&&i>=0&&i<9)||g.board[i]!=null)return'Bad square';g.board[i]=me;g.last=i;
  const w=tttWinner(g.board);if(w!=null)finish(g,w==='draw'?'draw':g.players[w]);else g.turn=1-me;return null}
 if(t==='c4'){const col=Number(b.pos);if(!(Number.isInteger(col)&&col>=0&&col<7))return'Bad column';const i=c4Drop(g.board,col);if(i<0)return'Column full';g.board[i]=me;g.last=i;
  const w=c4Winner(g.board);if(w!=null)finish(g,w==='draw'?'draw':g.players[w]);else g.turn=1-me;return null}
 if(t==='dots'){const i=Number(b.pos);if(!(Number.isInteger(i)&&i>=0&&i<40)||g.lines[i]!=null)return'Line taken';g.lines[i]=me;g.last=i;let got=false;
  for(const k of LINE_BOXES[i])if(g.boxes[k]==null&&sidesSet(g.lines,k)===4){g.boxes[k]=me;got=true}
  if(g.boxes.every(x=>x!=null)){const a=g.boxes.filter(x=>x===0).length;finish(g,a===8?'draw':a>8?g.players[0]:g.players[1])}else if(!got)g.turn=1-me;return null}
 if(t==='sink'){const x=Number(b.pos);if(!(Number.isInteger(x)&&x>=0&&x<64))return'Bad cell';if(g.shots[me][x])return'Already shot there';
  const opp=g.ships[1-me],hitK=opp.findIndex(c=>c.includes(x));g.shots[me][x]=hitK>=0?'hit':'miss';
  const sunk=hitK>=0&&opp[hitK].every(y=>g.shots[me][y]==='hit');g.lastShot={by:me,pos:x,result:hitK<0?'miss':sunk?'sunk':'hit',ship:sunk?hitK:null};
  if(opp.flat().every(y=>g.shots[me][y]==='hit'))finish(g,pid);else g.turn=1-me;return null}
 return'Unknown game'}
function botMove(g,bi){const hard=g.diff==='hard',t=g.type;
 if(t==='follow')return g.res[BOT]?null:followBot(hard);
 if(t==='hang')return hangState(g,bi).over?null:{letter:hangBot(g,bi,hard)};
 if(t==='sink'&&g.phase==='setup')return g.ships[bi]?null:{ships:'random'};
 if(g.turn!==bi)return null;
 return{pos:{ttt:tttBot,c4:c4Bot,dots:dotsBot,sink:sinkBot}[t](g,bi,hard)}}
function botAct(g){const bi=g.players.indexOf(BOT);if(bi<0)return;for(let n=0;n<300&&g.status==='active';n++){const m=botMove(g,bi);if(!m)return;const e=applyMove(g,bi,m);if(e){console.error('bot error',e);return}}}
function myTurn(g,me){if(g.status!=='active')return false;const t=g.type;
 if(t==='follow')return!g.res[g.players[me]];if(t==='hang')return!hangState(g,me).over;
 if(t==='sink'&&g.phase==='setup')return!g.ships[me];return g.turn===me}
function view(g,uid){const me=g.players.indexOf(uid),o={id:g.id,type:g.type,circleId:g.circleId,players:g.players,names:g.players.map(p=>db.users[p]?.name),
 turn:g.turn,status:g.status,winner:g.winner,updated:g.updated,diff:g.diff,me,myTurn:myTurn(g,me),last:g.last,vsBot:g.players.includes(BOT)};
 const done=g.status==='done',t=g.type;
 if(t==='ttt'||t==='c4')o.board=g.board;
 if(t==='dots'){o.lines=g.lines;o.boxes=g.boxes}
 if(t==='follow'){o.res=done?g.res:{[uid]:g.res[uid]};o.started=!!g.started[uid];if(g.started[uid]||done)o.seq=g.seq;o.seqMax=SEQMAX}
 if(t==='sink'){o.phase=g.phase;o.placed=[!!g.ships[0],!!g.ships[1]];o.myShips=g.ships[me];o.myShots=g.shots[me];o.theirShots=g.shots[1-me];o.lastShot=g.lastShot;
  const opp=g.ships[1-me];o.sunkTheirs=opp?sunkShips(opp,g.shots[me]).map(k=>({k,cells:opp[k]})):[];if(done)o.theirShips=opp}
 if(t==='hang'){const s=hangState(g,me),w=g.words[me],gs=g.guesses[me];o.mask=[...w].map(l=>gs.includes(l)||s.over?l:'_');o.myGuesses=gs;o.myMiss=s.miss;o.myOver=s.over;o.solved=s.solved;
  const th=hangState(g,1-me);o.theirOver=th.over;o.maxMiss=MAXMISS;if(done){o.theirWord=g.words[1-me];o.theirMiss=th.miss;o.theirSolved=th.solved}}
 return o}
const pub=u=>({id:u.id,name:u.name,stats:u.stats||{},botStats:u.botStats||{}});
const rows=(list,type,get,best)=>list.map(u=>{const s=get(u)?.[type]||{w:0,l:0,d:0},r={id:u.id,name:u.name,...s};if(type==='follow'&&best)r.best=best(u)?.follow||null;return r}).sort((a,b)=>b.w-a.w||a.l-b.l||a.name.localeCompare(b.name));
const routes={
 'POST /api/signup':(b)=>{const n=String(b.name||'').trim().slice(0,20);if(!n)return[400,{error:'Name required'}];
  const u={id:id(),token:id(16),name:n,circles:[],stats:{},botStats:{}};db.users[u.id]=u;return[200,u]},
 'GET /api/me':(b,u)=>[200,{...pub(u),token:u.token,circleList:u.circles.map(c=>({id:c,name:db.circles[c].name,code:db.circles[c].code,members:db.circles[c].members.filter(m=>m!==u.id).map(m=>({id:m,name:db.users[m].name}))}))}],
 'POST /api/circles':(b,u)=>{const c={id:id(),name:String(b.name||'My Circle').slice(0,30),code:code(),members:[u.id]};db.circles[c.id]=c;u.circles.push(c.id);return[200,c]},
 'POST /api/circles/join':(b,u)=>{const c=Object.values(db.circles).find(c=>c.code===String(b.code||'').toUpperCase().trim());
  if(!c)return[404,{error:'No circle with that code'}];if(!c.members.includes(u.id)){c.members.push(u.id);u.circles.push(c.id)}return[200,c]},
 'GET /api/circle':(b,u,q)=>{const c=db.circles[q.id];if(!c||!c.members.includes(u.id))return[404,{error:'Not found'}];
  const ms=c.members.map(m=>db.users[m]),boards={};for(const t of['all',...TYPES])boards[t]=rows(ms,t,x=>x.circleStats?.[c.id],x=>x.circleBest?.[c.id]);
  return[200,{id:c.id,name:c.name,code:c.code,members:ms.map(m=>({id:m.id,name:m.name})),boards}]},
 'GET /api/leaderboard':(b,u,q)=>{const t=TYPES.includes(q.type)?q.type:'all';
  return[200,rows(Object.values(db.users).filter(x=>x.id!==BOT),t,x=>x.stats,x=>x.best).filter(x=>x.w+x.l+x.d).slice(0,50)]},
 'POST /api/challenge':(b,u)=>{if(!TYPES.includes(b.type))return[400,{error:'Bad game type'}];const vsBot=b.opponentId===BOT;let c=null;
  if(!vsBot){c=db.circles[b.circleId];const o=db.users[b.opponentId];if(!c||!o||!c.members.includes(u.id)||!c.members.includes(o.id)||o.id===u.id)return[400,{error:'Bad challenge'}]}
  let word=null;if(b.type==='hang'&&b.word){word=String(b.word).toUpperCase().trim();if(!/^[A-Z]{3,12}$/.test(word))return[400,{error:'Secret word must be 3-12 letters, no spaces'}]}
  const g={id:id(),type:b.type,circleId:c?c.id:null,players:[u.id,vsBot?BOT:b.opponentId],turn:0,status:'active',winner:null,created:Date.now(),updated:Date.now(),diff:vsBot?(b.difficulty==='hard'?'hard':'easy'):null};
  if(g.type==='ttt')g.board=Array(9).fill(null);if(g.type==='c4')g.board=Array(42).fill(null);if(g.type==='follow'){g.seq=Array.from({length:SEQMAX},()=>crypto.randomInt(4));g.res={};g.started={}}
  if(g.type==='dots'){g.lines=Array(40).fill(null);g.boxes=Array(16).fill(null)}
  if(g.type==='sink'){g.phase='setup';g.ships=[null,null];g.shots=[{},{}]}
  if(g.type==='hang'){g.words=[rnd(WORDS),word||rnd(WORDS)];g.guesses=[[],[]]}
  db.games[g.id]=g;botAct(g);return[200,view(g,u.id)]},
 'GET /api/games':(b,u)=>[200,Object.values(db.games).filter(g=>g.players.includes(u.id)).sort((a,b)=>b.updated-a.updated).slice(0,40).map(g=>view(g,u.id))],
 'GET /api/game':(b,u,q)=>{const g=db.games[q.id];if(!g||!g.players.includes(u.id))return[404,{error:'Not found'}];return[200,view(g,u.id)]},
 'POST /api/move':(b,u)=>{const g=db.games[b.gameId];if(!g||!g.players.includes(u.id))return[404,{error:'Not found'}];
  const e=applyMove(g,g.players.indexOf(u.id),b);if(e)return[400,{error:e}];botAct(g);g.updated=Date.now();return[200,view(g,u.id)]},
};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');
 if(!u.pathname.startsWith('/api/')){const f=path.join(__dirname,'public',u.pathname==='/'?'index.html':path.normalize(u.pathname));
  if(!f.startsWith(path.join(__dirname,'public')))return send(res,403,{});
  fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nope')}res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'text/plain'});res.end(d)});return}
 let body='';req.on('data',c=>{body+=c;if(body.length>1e5)req.destroy()});req.on('end',()=>{
  const r=routes[req.method+' '+u.pathname];if(!r)return send(res,404,{error:'No route'});
  let b={};try{b=body?JSON.parse(body):{}}catch(e){return send(res,400,{error:'Bad JSON'})}
  const tok=req.headers['x-token'];const user=tok&&Object.values(db.users).find(x=>x.token===tok&&x.id!==BOT);
  if(u.pathname!=='/api/signup'&&u.pathname!=='/api/leaderboard'&&!user)return send(res,401,{error:'Sign up first'});
  try{const[s,o]=r(b,user,Object.fromEntries(u.searchParams));if(s===200&&req.method==='POST')save();send(res,s,o)}catch(e){console.error(e);send(res,500,{error:'Server clogged'})}})});
(async()=>{if(pool){await pool.query('CREATE TABLE IF NOT EXISTS pw_state(id int PRIMARY KEY, data jsonb NOT NULL)');
 const r=await pool.query('SELECT data FROM pw_state WHERE id=1');if(r.rows[0])db=r.rows[0].data;console.log('Using Postgres storage')}
 // old prototype data used a different format; start fresh if seen
 if(Object.values(db.games||{}).some(g=>g.type==='ttt'&&g.board.some(x=>typeof x==='string')))db={users:{},circles:{},games:{}};
 // Flush Frenzy (tap race) was removed: drop its games and stats, recompute 'all'
 for(const[k,g]of Object.entries(db.games||{}))if(g.type==='flush')delete db.games[k];
 const fix=o=>{if(!o||!o.flush)return;delete o.flush;const a={w:0,l:0,d:0};for(const t of TYPES)if(o[t])for(const x in a)a[x]+=o[t][x];o.all=a};
 for(const u of Object.values(db.users||{})){fix(u.stats);fix(u.botStats);for(const c of Object.values(u.circleStats||{}))fix(c)}
 ensureBot();server.listen(PORT,()=>console.log('🚽 Poop Wars on http://localhost:'+PORT))})().catch(e=>{console.error(e);process.exit(1)});
