// Data access: users, circles, games (versioned), stats, invites, safety tables.
const db=require('./db'),{id,code,hash,BOT}=require('./util'),{TYPES}=require('./games');
const userCols='id,name,kind,email,birthdate,owner_email,premium,pilot,created_at';
async function ensureBot(){await db.q(`INSERT INTO users(id,name,kind) VALUES($1,$2,'bot') ON CONFLICT(id) DO NOTHING`,[BOT,'Plunger Bot 🪠'])}
const userByToken=t=>t?db.one(`SELECT ${userCols} FROM users WHERE token_hash=$1 AND kind<>'bot'`,[hash(t)]):null;
const userById=i=>db.one(`SELECT ${userCols} FROM users WHERE id=$1`,[i]);
const userByAuth=a=>db.one(`SELECT ${userCols} FROM users WHERE auth_id=$1`,[a]);
async function newSession(uid){const tok=id(16);await db.q('UPDATE users SET token_hash=$1 WHERE id=$2',[hash(tok),uid]);return tok}
async function createGuest(){const u={id:id(),tok:id(16)};await db.q(`INSERT INTO users(id,name,kind,token_hash) VALUES($1,'Guest','guest',$2)`,[u.id,hash(u.tok)]);return{id:u.id,token:u.tok}}
// Creates a full account. Claims the invite code (single use) in the same transaction.
async function createUser({name,birthdate,email=null,authId=null,ownerEmail=null,inviteCode=null}){
 const uid=id(),tok=id(16);
 try{await db.tx(async c=>{
  await c.query(`INSERT INTO users(id,name,kind,token_hash,email,auth_id,birthdate,owner_email) VALUES($1,$2,'user',$3,$4,$5,$6,$7)`,[uid,name,hash(tok),email,authId,birthdate,ownerEmail]);
  if(inviteCode){const r=await c.query(`UPDATE invite_codes SET used_by=$1,used_at=now() WHERE code=$2 AND used_by IS NULL RETURNING kind`,[uid,inviteCode]);
   if(!r.rows[0]){const e=Error('Invite code is invalid or already used');e.status=400;throw e}
   const pilot=r.rows[0].kind==='pilot';await c.query('UPDATE users SET premium=true,pilot=$1,invite_code=$2 WHERE id=$3',[pilot,inviteCode,uid])}})}
 catch(e){await db.q('DELETE FROM users WHERE id=$1',[uid]).catch(()=>{});throw e}  // belt-and-braces: pg-mem rollback is not reliable
 return{id:uid,token:tok}}
async function redeemInvite(uid,inviteCode){return db.tx(async c=>{const r=await c.query(`UPDATE invite_codes SET used_by=$1,used_at=now() WHERE code=$2 AND used_by IS NULL RETURNING kind`,[uid,inviteCode]);
 if(!r.rows[0])return false;await c.query('UPDATE users SET premium=true,pilot=(pilot OR $1),invite_code=$2 WHERE id=$3',[r.rows[0].kind==='pilot',inviteCode,uid]);return true})}
async function createInvites(n,kind='pilot',note=null){const out=[];for(let i=0;i<n;i++){const c=code(8);await db.q('INSERT INTO invite_codes(code,kind,note) VALUES($1,$2,$3)',[c,kind,note]);out.push(c)}return out}
// pending OTP signups (Supabase verified, profile not yet filled in)
async function addPending(authId,email){const t=id(16);await db.q('INSERT INTO pending_signups(ticket_hash,auth_id,email,expires_ms) VALUES($1,$2,$3,$4)',[hash(t),authId,email,Date.now()+3600e3]);return t}
async function takePending(t){const r=await db.one('SELECT * FROM pending_signups WHERE ticket_hash=$1',[hash(t||'')]);if(!r)return null;await db.q('DELETE FROM pending_signups WHERE ticket_hash=$1',[hash(t)]);return Number(r.expires_ms)>Date.now()?r:null}
// circles
async function createCircle(uid,name){for(let i=0;i<5;i++){const c={id:id(),name,code:code()};
 try{await db.tx(async t=>{await t.query('INSERT INTO circles(id,name,code,owner_id) VALUES($1,$2,$3,$4)',[c.id,c.name,c.code,uid]);await t.query('INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2)',[c.id,uid])});return c}
 catch(e){if(!/unique|duplicate/i.test(e.message))throw e}}throw Error('Could not make a code')}
const circleByCode=c=>db.one('SELECT id,name,code FROM circles WHERE code=$1',[c]);
const circleById=c=>db.one('SELECT id,name,code,owner_id FROM circles WHERE id=$1',[c]);
const joinCircle=(cid,uid)=>db.q('INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[cid,uid]);
const leaveCircle=(cid,uid)=>db.q('DELETE FROM circle_members WHERE circle_id=$1 AND user_id=$2',[cid,uid]);
const members=cid=>db.all('SELECT u.id,u.name FROM circle_members m JOIN users u ON u.id=m.user_id WHERE m.circle_id=$1 ORDER BY m.joined_at',[cid]);
const isMember=async(cid,uid)=>!!(await db.one('SELECT 1 AS x FROM circle_members WHERE circle_id=$1 AND user_id=$2',[cid,uid]));
const circlesOf=uid=>db.all('SELECT c.id,c.name,c.code FROM circle_members m JOIN circles c ON c.id=m.circle_id WHERE m.user_id=$1 ORDER BY m.joined_at',[uid]);
// games
async function insertGame(g){g.updated=Date.now();await db.q('INSERT INTO games(id,type,circle_id,p0,p1,status,winner,state,version,updated_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$9)',
 [g.id,g.type,g.circleId,g.players[0],g.players[1],g.status,g.winner,JSON.stringify(g),g.updated])}
const rowToGame=r=>r&&({...r.state,version:r.version});
const getGame=async gid=>rowToGame(await db.one('SELECT state,version FROM games WHERE id=$1',[gid]));
const gamesOf=async uid=>(await db.all('SELECT state,version FROM games WHERE p0=$1 OR p1=$1 ORDER BY updated_ms DESC LIMIT 40',[uid])).map(rowToGame);
// Safe concurrent move: read state+version, apply in JS, write back only if version is unchanged
// (compare-and-swap inside a transaction, plus a moves row). On a lost race, reload and retry.
async function mutateGame(gid,uid,body,fn){
 for(let attempt=0;attempt<8;attempt++){
  const g=await getGame(gid);if(!g)return{error:'Not found',status:404};
  const v=g.version;delete g.version;const err=fn(g);if(err)return{error:err,status:400};
  g.updated=Date.now();
  const ok=await db.tx(async c=>{const r=await c.query('UPDATE games SET state=$1,status=$2,winner=$3,version=version+1,updated_ms=$4 WHERE id=$5 AND version=$6',
    [JSON.stringify(g),g.status,g.winner,g.updated,gid,v]);
   if(r.rowCount!==1)return false;await c.query('INSERT INTO moves(game_id,user_id,seq,body) VALUES($1,$2,$3,$4)',[gid,uid,v+1,JSON.stringify(body)]);return true});
  if(ok)return{game:g};await new Promise(r=>setTimeout(r,5+Math.random()*20))}
 return{error:'Busy, try again',status:409}}
const namesFor=async ids=>{const rs=await db.all('SELECT id,name FROM users WHERE id=$1 OR id=$2',ids);return ids.map(i=>rs.find(r=>r.id===i)?.name)};
// stats are derived from finished games (no counters to race on)
function agg(rows){const out={};const bump=(uid,type,k)=>{const u=out[uid]=out[uid]||{stats:{},best:{}};for(const t of[type,'all']){u.stats[t]=u.stats[t]||{w:0,l:0,d:0};u.stats[t][k]++}};
 const{better}=require('./games/follow');
 for(const r of rows){const ps=[r.p0,r.p1];for(const p of ps){if(p===BOT)continue;bump(p,r.type,r.winner==='draw'?'d':r.winner===p?'w':'l');
   if(r.type==='follow'&&!ps.includes(BOT)){const res=r.state.res[p];const u=out[p];if(res&&(!u.best.follow||better(res,u.best.follow)))u.best.follow={len:res.len,ms:res.ms}}}}
 return out}
const doneRows=(where,params)=>db.all(`SELECT type,p0,p1,winner,circle_id,state FROM games WHERE status='done' AND ${where}`,params);
const globalStats=async()=>agg(await doneRows(`p1<>'bot' AND p0<>'bot'`,[]));
const userStats=async uid=>(agg(await doneRows(`p1<>'bot' AND (p0=$1 OR p1=$1)`,[uid]))[uid])||{stats:{},best:{}};
const botStats=async uid=>(agg(await doneRows(`p1='bot' AND p0=$1`,[uid]))[uid]||{stats:{}}).stats;
const circleStats=async cid=>agg(await doneRows(`circle_id=$1`,[cid]));
const listUsers=()=>db.all(`SELECT id,name FROM users WHERE kind='user'`);
// safety
const PRESET_TAUNTS={plop:'Plop plop! 💩',flush:'Get flushed! 🚽',clog:'You clogged it 🪠',tp:'Out of TP? 🧻',duck:'Quack quack, loser 🦆',gg:'Good game! 🤝',rematch:'Rematch? 🔁',lucky:'Lucky wipe 😤',stink:'Something stinks… your moves 😷',throne:'Bow to the throne 👑'};
const isBlocked=async(a,b)=>!!(await db.one('SELECT 1 AS x FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[a,b]));
const block=(a,b)=>db.q('INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[a,b]);
const unblock=(a,b)=>db.q('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2',[a,b]);
const addTaunt=(gid,from,to,key)=>db.one('INSERT INTO taunts(game_id,from_id,to_id,taunt_key) VALUES($1,$2,$3,$4) RETURNING id',[gid,from,to,key]);
const tauntsFor=gid=>db.all('SELECT id,from_id,taunt_key,created_at FROM taunts WHERE game_id=$1 ORDER BY id DESC LIMIT 20',[gid]);
const countTaunts=async(gid,uid)=>Number((await db.one('SELECT count(*) AS n FROM taunts WHERE game_id=$1 AND from_id=$2',[gid,uid])).n);
const report=(r)=>db.one('INSERT INTO reports(reporter_id,reported_id,game_id,taunt_id,reason) VALUES($1,$2,$3,$4,$5) RETURNING id',[r.reporter,r.reported,r.gameId,r.tauntId,r.reason]);
module.exports={ensureBot,userByToken,userById,userByAuth,newSession,createGuest,createUser,redeemInvite,createInvites,addPending,takePending,
 createCircle,circleByCode,circleById,joinCircle,leaveCircle,members,isMember,circlesOf,insertGame,getGame,gamesOf,mutateGame,namesFor,
 globalStats,userStats,botStats,circleStats,listUsers,PRESET_TAUNTS,isBlocked,block,unblock,addTaunt,tauntsFor,countTaunts,report,TYPES};
