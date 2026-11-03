// Poop Wars prototype server. No dependencies. Run: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3737, DB=path.join(__dirname,'data.json');
let db={users:{},circles:{},games:{}};
// Storage: Postgres if DATABASE_URL is set (Render), else local data.json file.
let pool=null,saving=Promise.resolve();
if(process.env.DATABASE_URL){const{Pool}=require('pg');
 pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false}})}
else{try{db=JSON.parse(fs.readFileSync(DB))}catch(e){}}
const save=()=>{if(!pool)return fs.writeFileSync(DB,JSON.stringify(db,null,1));
 const snap=JSON.stringify(db);saving=saving.then(()=>pool.query('INSERT INTO pw_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=$1',[snap])).catch(e=>console.error('save failed',e))};
const id=(n=8)=>crypto.randomBytes(n).toString('hex');
const code=()=>Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random()*32|0]).join('');
const send=(res,s,o)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const TTT_LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function tttWinner(b){for(const[a,c,d]of TTT_LINES)if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return b.every(x=>x)?'draw':null}
function c4Winner(b){const R=6,C=7,g=(r,c)=>r>=0&&r<R&&c>=0&&c<C?b[r*C+c]:null;
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){const v=g(r,c);if(!v)continue;
  for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]])if([1,2,3].every(k=>g(r+dr*k,c+dc*k)===v))return v}
 return b.every(x=>x)?'draw':null}
function finish(g,w){g.status='done';g.winner=w;const[p0,p1]=g.players;
 const rec=(u,k)=>{const x=db.users[u];x[k]=(x[k]||0)+1;const cs=(x.circleStats||={});const s=(cs[g.circleId]||={w:0,l:0,d:0});s[k[0]]++};
 if(w==='draw'){rec(p0,'draws');rec(p1,'draws')}else{rec(w,'wins');rec(w===p0?p1:p0,'losses')}}
function view(g){return{...g,names:g.players.map(p=>db.users[p]?.name),
 scores:g.type==='flush'?(g.status==='done'?g.scores:Object.fromEntries(Object.keys(g.scores).map(k=>[k,'?']))):undefined}}
const routes={
 'POST /api/signup':(b)=>{const n=String(b.name||'').trim().slice(0,20);if(!n)return[400,{error:'Name required'}];
  const u={id:id(),token:id(16),name:n,circles:[],wins:0,losses:0,draws:0};db.users[u.id]=u;return[200,u]},
 'GET /api/me':(b,u)=>[200,{...u,circleList:u.circles.map(c=>({id:c,name:db.circles[c].name,code:db.circles[c].code}))}],
 'POST /api/circles':(b,u)=>{const c={id:id(),name:String(b.name||'My Circle').slice(0,30),code:code(),members:[u.id]};
  db.circles[c.id]=c;u.circles.push(c.id);return[200,c]},
 'POST /api/circles/join':(b,u)=>{const c=Object.values(db.circles).find(c=>c.code===String(b.code||'').toUpperCase().trim());
  if(!c)return[404,{error:'No circle with that code'}];if(!c.members.includes(u.id)){c.members.push(u.id);u.circles.push(c.id)}return[200,c]},
 'GET /api/circle':(b,u,q)=>{const c=db.circles[q.id];if(!c||!c.members.includes(u.id))return[404,{error:'Not found'}];
  const members=c.members.map(m=>{const x=db.users[m],s=x.circleStats?.[c.id]||{w:0,l:0,d:0};return{id:m,name:x.name,...s}}).sort((a,b)=>b.w-a.w||a.l-b.l);
  return[200,{...c,members}]},
 'GET /api/leaderboard':()=>[200,Object.values(db.users).map(x=>({name:x.name,w:x.wins,l:x.losses,d:x.draws})).filter(x=>x.w+x.l+x.d).sort((a,b)=>b.w-a.w||a.l-b.l).slice(0,50)],
 'POST /api/challenge':(b,u)=>{const c=db.circles[b.circleId],o=db.users[b.opponentId];
  if(!c||!o||!c.members.includes(u.id)||!c.members.includes(o.id)||o.id===u.id)return[400,{error:'Bad challenge'}];
  if(!['ttt','c4','flush'].includes(b.type))return[400,{error:'Bad game type'}];
  const g={id:id(),type:b.type,circleId:c.id,players:[u.id,o.id],turn:0,status:'active',winner:null,created:Date.now(),updated:Date.now(),
   board:b.type==='ttt'?Array(9).fill(null):b.type==='c4'?Array(42).fill(null):null,scores:b.type==='flush'?{}:undefined};
  db.games[g.id]=g;return[200,view(g)]},
 'GET /api/games':(b,u)=>[200,Object.values(db.games).filter(g=>g.players.includes(u.id)).sort((a,b)=>b.updated-a.updated).slice(0,40).map(view)],
 'GET /api/game':(b,u,q)=>{const g=db.games[q.id];if(!g||!g.players.includes(u.id))return[404,{error:'Not found'}];return[200,view(g)]},
 'POST /api/move':(b,u)=>{const g=db.games[b.gameId];if(!g||!g.players.includes(u.id))return[404,{error:'Not found'}];
  if(g.status!=='active')return[400,{error:'Game over'}];const me=g.players.indexOf(u.id);
  if(g.type==='flush'){ if(g.scores[u.id]!=null)return[400,{error:'Already played'}];
   const t=Number(b.ms);if(!(t>=1500&&t<120000))return[400,{error:'Suspicious time 🤨'}];g.scores[u.id]=t;
   if(Object.keys(g.scores).length===2){const[a,c]=g.players.map(p=>g.scores[p]);finish(g,a===c?'draw':a<c?g.players[0]:g.players[1])}}
  else{ if(g.turn!==me)return[400,{error:'Not your turn'}];const mark=me?'💩':'🧻';let i=Number(b.pos);
   if(g.type==='c4'){const col=i;if(!(col>=0&&col<7))return[400,{error:'Bad column'}];i=-1;for(let r=5;r>=0;r--)if(!g.board[r*7+col]){i=r*7+col;break}
    if(i<0)return[400,{error:'Column full'}]}
   else if(!(i>=0&&i<9)||g.board[i])return[400,{error:'Bad square'}];
   g.board[i]=mark;g.last=i;const w=(g.type==='ttt'?tttWinner:c4Winner)(g.board);
   if(w)finish(g,w==='draw'?'draw':u.id);else g.turn=1-me}
  g.updated=Date.now();return[200,view(g)]},
};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');
 if(!u.pathname.startsWith('/api/')){let f=path.join(__dirname,'public',u.pathname==='/'?'index.html':path.normalize(u.pathname));
  if(!f.startsWith(path.join(__dirname,'public')))return send(res,403,{});
  fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nope')}res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'text/plain'});res.end(d)});return}
 let body='';req.on('data',c=>{body+=c;if(body.length>1e5)req.destroy()});req.on('end',()=>{
  const r=routes[req.method+' '+u.pathname];if(!r)return send(res,404,{error:'No route'});
  let b={};try{b=body?JSON.parse(body):{}}catch(e){return send(res,400,{error:'Bad JSON'})}
  const tok=req.headers['x-token'];const user=Object.values(db.users).find(x=>x.token===tok);
  if(u.pathname!=='/api/signup'&&u.pathname!=='/api/leaderboard'&&!user)return send(res,401,{error:'Sign up first'});
  try{const[s,o]=r(b,user,Object.fromEntries(u.searchParams));if(s===200)save();send(res,s,o)}catch(e){console.error(e);send(res,500,{error:'Server clogged'})}})
});
(async()=>{if(pool){await pool.query('CREATE TABLE IF NOT EXISTS pw_state(id int PRIMARY KEY, data jsonb NOT NULL)');
 const r=await pool.query('SELECT data FROM pw_state WHERE id=1');if(r.rows[0])db=r.rows[0].data;console.log('Using Postgres storage')}
 server.listen(PORT,()=>console.log('🚽 Poop Wars on http://localhost:'+PORT))})().catch(e=>{console.error(e);process.exit(1)});
