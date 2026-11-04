// Data access: users, circles, games (versioned), stats, invites, safety tables.
const db=require('./db'),{id,code,hash,BOT}=require('./util'),{TYPES}=require('./games');
const userCols='id,name,kind,email,accepted_rules_at,premium,pilot,premium_source,created_at';
async function ensureBot(){await db.q(`INSERT INTO users(id,name,kind) VALUES($1,$2,'bot') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,[BOT,'Plunger Pete 🪠'])}
const userByToken=t=>t?db.one(`SELECT ${userCols} FROM users WHERE token_hash=$1 AND kind<>'bot'`,[hash(t)]):null;
const userById=i=>db.one(`SELECT ${userCols} FROM users WHERE id=$1`,[i]);
const userByAuth=a=>db.one(`SELECT ${userCols} FROM users WHERE auth_id=$1`,[a]);
async function newSession(uid){const tok=id(16);await db.q('UPDATE users SET token_hash=$1 WHERE id=$2',[hash(tok),uid]);return tok}
async function createGuest(){const u={id:id(),tok:id(16)};await db.q(`INSERT INTO users(id,name,kind,token_hash) VALUES($1,'Guest','guest',$2)`,[u.id,hash(u.tok)]);return{id:u.id,token:u.tok}}
// OPEN_PREMIUM=true: every new signup is tagged premium_source='open_pilot'. That premium only counts while the flag is on
// (see isPremium in routes.js); invite-code premium/pilot (users.premium / users.pilot) is separate and permanent.
const openPremium=()=>/^(1|true|yes|on)$/i.test(process.env.OPEN_PREMIUM||'');
// Creates a full account. Claims the invite code (single use) in the same transaction.
async function createUser({name,email=null,authId=null,inviteCode=null,acceptedRules=false}){
 const uid=id(),tok=id(16);
 try{await db.tx(async c=>{
  await c.query(`INSERT INTO users(id,name,kind,token_hash,email,auth_id,accepted_rules_at,premium_source) VALUES($1,$2,'user',$3,$4,$5,$6,$7)`,[uid,name,hash(tok),email,authId,acceptedRules?new Date():null,openPremium()?'open_pilot':null]);
  if(inviteCode){const r=await c.query(`UPDATE invite_codes SET used_by=$1,used_at=now() WHERE code=$2 AND used_by IS NULL RETURNING kind`,[uid,inviteCode]);
   if(!r.rows[0]){const e=Error('Invite code is invalid or already used');e.status=400;throw e}
   const pilot=r.rows[0].kind==='pilot';await c.query('UPDATE users SET premium=true,pilot=$1,invite_code=$2,premium_source=$4 WHERE id=$3',[pilot,inviteCode,uid,pilot?'invite_pilot':'invite'])}})}
 catch(e){await db.q('DELETE FROM users WHERE id=$1',[uid]).catch(()=>{});throw e}  // belt-and-braces: pg-mem rollback is not reliable
 return{id:uid,token:tok}}
async function redeemInvite(uid,inviteCode){return db.tx(async c=>{const r=await c.query(`UPDATE invite_codes SET used_by=$1,used_at=now() WHERE code=$2 AND used_by IS NULL RETURNING kind`,[uid,inviteCode]);
 if(!r.rows[0])return false;await c.query('UPDATE users SET premium=true,pilot=(pilot OR $1),invite_code=$2,premium_source=CASE WHEN (pilot OR $1) THEN $4 ELSE $5 END WHERE id=$3',[r.rows[0].kind==='pilot',inviteCode,uid,'invite_pilot','invite']);return true})}
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
const GAME_INS='INSERT INTO games(id,type,circle_id,p0,p1,status,winner,state,version,updated_ms,random) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10)';
const gameRow=g=>[g.id,g.type,g.circleId,g.players[0],g.players[1],g.status,g.winner,JSON.stringify(g),g.updated,!!g.random];
async function insertGame(g){g.updated=Date.now();await db.q(GAME_INS,gameRow(g))}
// ---- quick match queue ----
// Race-free pairing: a pair is made by ONE conditional UPDATE that claims both queue rows (yours and theirs) only while both are
// still unclaimed (game_id IS NULL), in the same transaction as the game insert. Postgres row locks make a second, concurrent claim
// on either row re-check and find game_id set, so it claims fewer than 2 rows and is undone. Each person ends up in at most one game.
const QUEUE_STALE_MS=Number(process.env.MATCH_STALE_MS)||120000;
async function matchStep(uid,type,makeGame,{join=false}={}){const now=Date.now();
 await db.q('DELETE FROM match_queue WHERE (game_id IS NULL AND seen_ms<$1) OR (game_id IS NOT NULL AND seen_ms<$2)',[now-QUEUE_STALE_MS,now-600000]);
 let mine=await db.one('SELECT type,joined_ms,game_id FROM match_queue WHERE user_id=$1',[uid]);
 if(mine&&mine.game_id){await db.q('DELETE FROM match_queue WHERE user_id=$1',[uid]);return{gameId:mine.game_id}}
 if(!mine&&!join)return{gone:true};
 if(!mine||join&&mine.type!==type){await db.q('INSERT INTO match_queue(user_id,type,joined_ms,seen_ms) VALUES($1,$2,$3,$3) ON CONFLICT (user_id) DO UPDATE SET type=$2,joined_ms=$3,seen_ms=$3 WHERE match_queue.game_id IS NULL',[uid,type,now]);mine={type,joined_ms:now}}
 else await db.q('UPDATE match_queue SET seen_ms=$1 WHERE user_id=$2',[now,uid]);
 const t=mine.type;
 const blocked=new Set((await db.all('SELECT blocker_id,blocked_id FROM blocks WHERE blocker_id=$1 OR blocked_id=$1',[uid])).map(r=>r.blocker_id===uid?r.blocked_id:r.blocker_id));
 const cands=(await db.all('SELECT user_id FROM match_queue WHERE type=$1 AND game_id IS NULL AND user_id<>$2 AND seen_ms>=$3 ORDER BY joined_ms LIMIT 50',[t,uid,now-QUEUE_STALE_MS]))
  .filter(c=>!blocked.has(c.user_id)).slice(0,5);
 for(const c of cands){const g=makeGame(t,[c.user_id,uid]);g.updated=Date.now();   // whoever waited longer moves first
  const won=await db.tx(async cl=>{const r=await cl.query('UPDATE match_queue SET game_id=$1,seen_ms=$2 WHERE user_id IN ($3,$4) AND game_id IS NULL RETURNING user_id',[g.id,now,c.user_id,uid]);
   if(r.rows.length!==2){await cl.query('UPDATE match_queue SET game_id=NULL WHERE game_id=$1',[g.id]);const e=Error('lost');e.lost=true;throw e}
   await cl.query(GAME_INS,gameRow(g));return true}).catch(e=>{if(!e.lost)console.error('match claim',e.message);return false});
  if(won){await db.q('DELETE FROM match_queue WHERE user_id=$1',[uid]);return{gameId:g.id}}
  const still=await db.one('SELECT game_id FROM match_queue WHERE user_id=$1',[uid]);if(still&&still.game_id){await db.q('DELETE FROM match_queue WHERE user_id=$1',[uid]);return{gameId:still.game_id}}}
 return{waiting:true,type:t,since:Number(mine.joined_ms)}}
async function cancelMatch(uid){const r=await db.one('DELETE FROM match_queue WHERE user_id=$1 RETURNING game_id',[uid]);return r&&r.game_id?{gameId:r.game_id}:{ok:true}}
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
  if(ok){if(g.status==='done')await clearTaunts(gid);return{game:g}}await new Promise(r=>setTimeout(r,5+Math.random()*20))}
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
const PRESET_EMOJI={'e:poop':'💩','e:laugh':'😂','e:fire':'🔥','e:cry':'😭','e:shock':'😱','e:cool':'😎','e:clap':'👏','e:skull':'💀','e:plunger':'🪠','e:tp':'🧻'};
const PRESET_TAUNTS={plop:'Plop plop! 💩',flush:'Get flushed! 🚽',clog:'You clogged it 🪠',tp:'Out of TP? 🧻',duck:'Quack quack, loser 🦆',gg:'Good game! 🤝',rematch:'Rematch? 🔁',lucky:'Lucky wipe 😤',stink:'Something stinks… your moves 😷',throne:'Bow to the throne 👑'};
const presetText=k=>PRESET_TAUNTS[k]||PRESET_EMOJI[k]||null;
const isBlocked=async(a,b)=>!!(await db.one('SELECT 1 AS x FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',[a,b]));
const block=(a,b)=>db.q('INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[a,b]);
const unblock=(a,b)=>db.q('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2',[a,b]);
// Taunts are ephemeral: wiped when the game finishes, and anything older than 24h is swept.
const DAY_MS=24*3600*1000;
const sweepTaunts=()=>db.q("DELETE FROM taunts WHERE created_at < $1 OR game_id IN (SELECT id FROM games WHERE status='done')",[new Date(Date.now()-DAY_MS)]);
const clearTaunts=gid=>db.q('DELETE FROM taunts WHERE game_id=$1',[gid]);
const addTaunt=(gid,from,to,key,body)=>db.one('INSERT INTO taunts(game_id,from_id,to_id,taunt_key,body) VALUES($1,$2,$3,$4,$5) RETURNING id',[gid,from,to,key||null,body||null]);
const tauntsFor=gid=>db.all('SELECT id,from_id,taunt_key,body,created_at FROM taunts WHERE game_id=$1 AND created_at > $2 ORDER BY id DESC LIMIT 20',[gid,new Date(Date.now()-DAY_MS)]);
const tauntById=id=>db.one('SELECT * FROM taunts WHERE id=$1',[id]);
const countTaunts=async(gid,uid)=>Number((await db.one('SELECT count(*) AS n FROM taunts WHERE game_id=$1 AND from_id=$2',[gid,uid])).n);
const report=(r)=>db.one('INSERT INTO reports(reporter_id,reported_id,game_id,taunt_id,reason,message) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[r.reporter,r.reported,r.gameId,r.tauntId,r.reason,r.message||null]);
const reportById=id=>db.one('SELECT * FROM reports WHERE id=$1',[id]);
module.exports={matchStep,cancelMatch,PRESET_EMOJI,presetText,openPremium,ensureBot,userByToken,userById,userByAuth,newSession,createGuest,createUser,redeemInvite,createInvites,addPending,takePending,
 createCircle,circleByCode,circleById,joinCircle,leaveCircle,members,isMember,circlesOf,insertGame,getGame,gamesOf,mutateGame,namesFor,
 globalStats,userStats,botStats,circleStats,listUsers,PRESET_TAUNTS,isBlocked,block,unblock,addTaunt,tauntsFor,countTaunts,report,reportById,tauntById,sweepTaunts,clearTaunts,TYPES};
