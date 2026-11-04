// HTTP API routes. Each handler gets {b (JSON body), u (user or null), q (query)} and returns [status, body].
const S=require('./store'),A=require('./auth'),E=require('./games'),{id,BOT}=require('./util');
const{TYPES}=E;
// Premium: invite-code premium/pilot always; open-pilot signups only while OPEN_PREMIUM is on.
const isPremium=u=>!!(u&&u.kind==='user'&&(u.premium||u.pilot||(u.premium_source==='open_pilot'&&S.openPremium())));
const fail=(s,m)=>[s,{error:m}];
const rows=(list,type,statsOf)=>list.map(u=>{const st=statsOf[u.id]||{stats:{},best:{}},s=st.stats[type]||{w:0,l:0,d:0},r={id:u.id,name:u.name,...s};
 if(type==='follow')r.best=st.best.follow||null;return r}).sort((a,b)=>b.w-a.w||a.l-b.l||a.name.localeCompare(b.name));
async function gameView(g,uid){const o=E.view(g,uid,await S.namesFor(g.players));
 if(!o.vsBot)o.taunts=(await S.tauntsFor(g.id)).map(t=>({id:t.id,from:t.from_id,key:t.taunt_key,text:t.body!=null?t.body:S.presetText(t.taunt_key)}));
 o.random=!!g.random;o.freeText=!!g.circleId&&!g.random;return o}
// Signup gate: the player must tick "I certify I am 13 or older and agree to the Poop Wars rules". Checked here on the server.
const RULES_TEXT='I certify I am 13 or older and agree to the Poop Wars rules.';
async function profileChecks(b){if(b.acceptRules!==true)return{err:fail(400,'Please confirm you are 13 or older and agree to the rules.')};
 const name=String(b.name||'').trim().slice(0,20);if(!name)return{err:fail(400,'Name required')};
 const inviteCode=b.inviteCode?String(b.inviteCode).toUpperCase().trim():null;return{name,inviteCode}}
const quickGame=(type,players)=>E.newGame({id:id(),type,circleId:null,players,created:Date.now(),diff:null,random:true},{},false);
const F=require('./filter');const TALK_MAX=60,TALK_GAP_MS=Number(process.env.TALK_GAP_MS||3000),lastTalk=new Map();
const P={premium:true},PUB={public:true},ANY={};   // route flags
const routes={
 'GET /api/config':[PUB,async()=>[200,{auth:A.supabaseEnabled()?'email-otp':'dev-name',taunts:S.PRESET_TAUNTS,emoji:S.PRESET_EMOJI,quickMatch:true,minAge:13,rulesText:RULES_TEXT,contact:process.env.CONTACT_EMAIL||null,openPremium:S.openPremium()}]],
 // Free tier: play vs Plunger Pete with no account and no saved scores.
 'POST /api/guest':[PUB,async()=>[200,await S.createGuest()]],
 // Supabase email code flow
 'POST /api/auth/start':[PUB,async({b})=>{if(!A.supabaseEnabled())return fail(501,'Email login not configured on this server (dev mode uses /api/signup)');
  const email=String(b.email||'').trim().toLowerCase();if(!A.validEmail(email))return fail(400,'Enter a valid email');await A.sendCode(email);return[200,{sent:true}]}],
 'POST /api/auth/verify':[PUB,async({b})=>{if(!A.supabaseEnabled())return fail(501,'Email login not configured');
  const email=String(b.email||'').trim().toLowerCase(),code=String(b.code||'').replace(/\s+/g,'');
  if(!A.validEmail(email))return fail(400,'Enter a valid email');if(!/^\d{6,8}$/.test(code))return fail(400,'Enter the 6 to 8 digit code from your email');
  const v=await A.verifyCode(email,code);
  const u=await S.userByAuth(v.authId);if(u)return[200,{id:u.id,token:await S.newSession(u.id)}];
  return[200,{needsProfile:true,ticket:await S.addPending(v.authId,v.email)}]}],
 // Create the account. Requires acceptRules:true (13+ and rules); the acceptance time is stored.
 'POST /api/signup':[PUB,async({b})=>{const p=await profileChecks(b);if(p.err)return p.err;let email=null,authId=null;
  if(A.supabaseEnabled()){const t=await S.takePending(b.ticket);if(!t)return fail(401,'Verify your email code first');email=t.email;authId=t.auth_id}
  const r=await S.createUser({name:p.name,email,authId,acceptedRules:true});const u=await S.userById(r.id);
  return[200,{id:r.id,token:r.token,name:u.name,premium:isPremium(u),pilot:u.pilot,premiumSource:isPremium(u)?(u.premium||u.pilot?u.premium_source||'invite':'open_pilot'):null}]}],
 'POST /api/redeem':[ANY,async({b,u})=>{if(u.kind!=='user')return fail(403,'Make an account first');
  return await S.redeemInvite(u.id,String(b.code||'').toUpperCase().trim())?[200,{ok:true}]:fail(400,'Invite code is invalid or already used')}],
 'GET /api/me':[ANY,async({u})=>{const prem=isPremium(u),o={id:u.id,name:u.name,kind:u.kind,premium:prem,pilot:u.pilot,premiumSource:prem?(u.premium||u.pilot?u.premium_source||'invite':'open_pilot'):null,circleList:[],stats:{},botStats:{}};
  if(prem){o.stats=(await S.userStats(u.id)).stats;o.botStats=await S.botStats(u.id);
   o.circleList=await Promise.all((await S.circlesOf(u.id)).map(async c=>({...c,members:(await S.members(c.id)).filter(m=>m.id!==u.id)})))}return[200,o]}],
 // ---- premium: saved scores, trophies, circles, arena ----
 'GET /api/scores':[P,async({u})=>{const s=await S.userStats(u.id);return[200,{stats:s.stats,best:s.best,botStats:await S.botStats(u.id)}]}],
 'GET /api/trophies':[P,async({u})=>{const s=await S.userStats(u.id),all=s.stats.all||{w:0},t=[];
  if(all.w>=1)t.push({key:'first',name:'First Flush',e:'🥇'});if(all.w>=10)t.push({key:'ten',name:'Porcelain Pro',e:'🏆'});
  for(const ty of TYPES)if(s.stats[ty]?.w>=3)t.push({key:'win3-'+ty,name:'3 wins: '+ty,e:'⭐'});if(s.best.follow?.len>=10)t.push({key:'memory',name:'Flush Memory',e:'🧠'});return[200,t]}],
 'POST /api/circles':[P,async({b,u})=>[200,await S.createCircle(u.id,String(b.name||'My Circle').slice(0,30))]],
 'POST /api/circles/join':[P,async({b,u})=>{const c=await S.circleByCode(String(b.code||'').toUpperCase().trim());if(!c)return fail(404,'No circle with that code');await S.joinCircle(c.id,u.id);return[200,c]}],
 'POST /api/circles/leave':[P,async({b,u})=>{await S.leaveCircle(String(b.circleId||''),u.id);return[200,{ok:true}]}],
 'GET /api/circle':[P,async({u,q})=>{const c=await S.circleById(q.id);if(!c||!await S.isMember(c.id,u.id))return fail(404,'Not found');
  const ms=await S.members(c.id),st=await S.circleStats(c.id),boards={};for(const t of['all',...TYPES])boards[t]=rows(ms,t,st);return[200,{id:c.id,name:c.name,code:c.code,members:ms,boards}]}],
 'GET /api/leaderboard':[PUB,async({q})=>{const t=TYPES.includes(q.type)?q.type:'all',st=await S.globalStats();
  return[200,rows(await S.listUsers(),t,st).filter(x=>x.w+x.l+x.d).slice(0,50)]}],
 'GET /api/taunts':[PUB,async()=>[200,S.PRESET_TAUNTS]],
 // Chat rules: quick-match (random) games allow only preset taunts + preset emoji (any signed-in user).
 // Free text (60 chars, filtered) only in circle games, where both players must still share that circle (premium).
 'POST /api/taunt':[ANY,async({b,u})=>{const g=await S.getGame(String(b.gameId||''));if(!g||!g.players.includes(u.id))return fail(404,'Not found');
  if(!g.random&&!isPremium(u))return fail(402,'Trash talk is a premium feature');
  if(g.status==='done')return fail(400,'Game is over');
  let key=null,body=null;
  if(b.key!=null){if(!S.presetText(b.key))return fail(400,'Unknown taunt');key=b.key}
  else if(g.random)return fail(400,'Quick match chat is preset taunts and emoji only');
  else if(!g.circleId||!(await S.isMember(g.circleId,g.players[0])&&await S.isMember(g.circleId,g.players[1])))return fail(400,'Free-text trash talk is only for games with people in your circle');
  else{body=String(b.text||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();if(!body)return fail(400,'Say something');
   if([...body].length>TALK_MAX)return fail(400,`Keep it to ${TALK_MAX} characters`);
   const f=F.check(body);if(!f.ok)return fail(400,'Not allowed. Keep it friendly 🧼');body=f.text}
  const to=g.players.find(p=>p!==u.id);if(to===BOT)return fail(400,'Plunger Pete cannot hear you');
  if(await S.isBlocked(u.id,to))return fail(403,'Blocked');
  const now=Date.now(),last=lastTalk.get(u.id)||0;if(now-last<TALK_GAP_MS)return fail(429,'Slow down! One message every 3 seconds');
  if(await S.countTaunts(g.id,u.id)>=20)return fail(429,'That is enough trash talk for one game');
  lastTalk.set(u.id,now);if(lastTalk.size>5000)for(const[k,t]of lastTalk)if(now-t>TALK_GAP_MS)lastTalk.delete(k);
  const r=await S.addTaunt(g.id,u.id,to,key,body);return[200,{id:r.id,text:body!=null?body:S.presetText(key)}]}],
 // ---- safety (any account) ----
 'POST /api/report':[ANY,async({b,u})=>{const who=String(b.userId||'');if(!who||who===u.id||!await S.userById(who))return fail(400,'Bad report');
  const reason=['mean','spam','inappropriate','other'].includes(b.reason)?b.reason:'other';
  const tid=Number.isInteger(b.tauntId)?b.tauntId:null;let message=null;
  if(tid!=null){const t=await S.tauntById(tid);if(t&&t.from_id===who&&t.to_id===u.id)message=t.body!=null?t.body:S.presetText(t.taunt_key)||t.taunt_key}
  const r=await S.report({reporter:u.id,reported:who,gameId:b.gameId||null,tauntId:tid,reason,message});return[200,{id:r.id}]}],
 'POST /api/block':[ANY,async({b,u})=>{const who=String(b.userId||'');if(!who||who===u.id||who===BOT||!await S.userById(who))return fail(400,'Bad block');await S.block(u.id,who);return[200,{ok:true}]}],
 'POST /api/unblock':[ANY,async({b,u})=>{await S.unblock(u.id,String(b.userId||''));return[200,{ok:true}]}],
 // ---- quick match: any signed-in account (not guests). Not premium-gated; see README. ----
 'POST /api/match/join':[ANY,async({b,u})=>{if(u.kind!=='user')return fail(403,'Make an account to play strangers');if(!TYPES.includes(b.type))return fail(400,'Bad game type');
  return[200,await S.matchStep(u.id,b.type,quickGame,{join:true})]}],
 'GET /api/match/poll':[ANY,async({u})=>[200,await S.matchStep(u.id,null,quickGame)]],
 'POST /api/match/cancel':[ANY,async({u})=>[200,await S.cancelMatch(u.id)]],
 // ---- games ----
 'POST /api/challenge':[ANY,async({b,u})=>{if(!TYPES.includes(b.type))return fail(400,'Bad game type');const vsBot=b.opponentId===BOT;let cid=null;
  if(!vsBot){if(!isPremium(u))return fail(402,'Challenging friends is a premium feature');
   const c=await S.circleById(b.circleId),o=await S.userById(b.opponentId);
   if(!c||!o||o.id===u.id||!await S.isMember(c.id,u.id)||!await S.isMember(c.id,o.id))return fail(400,'Bad challenge');
   if(await S.isBlocked(u.id,o.id))return fail(403,'You cannot challenge this player');cid=c.id}
  const m=E.GAMES[b.type];if(m.validateOpts){const e=m.validateOpts(b);if(e)return fail(400,e)}
  const g=E.newGame({id:id(),type:b.type,circleId:cid,players:[u.id,vsBot?BOT:b.opponentId],created:Date.now(),diff:vsBot?(b.difficulty==='hard'?'hard':'easy'):null},b,vsBot);
  E.botAct(g);await S.insertGame(g);return[200,await gameView(g,u.id)]}],
 'GET /api/games':[ANY,async({u})=>{const gs=await S.gamesOf(u.id),names={};
  return[200,await Promise.all(gs.map(async g=>E.view(g,u.id,await S.namesFor(g.players))))]}],
 'GET /api/game':[ANY,async({u,q})=>{const g=await S.getGame(q.id);if(!g||!g.players.includes(u.id))return fail(404,'Not found');return[200,await gameView(g,u.id)]}],
 'POST /api/move':[ANY,async({b,u})=>{const gid=String(b.gameId||'');const body={...b};delete body.gameId;
  const r=await S.mutateGame(gid,u.id,body,g=>{if(!g.players.includes(u.id))return'Not found';const e=E.applyMove(g,g.players.indexOf(u.id),b);if(e)return e;E.botAct(g);return null});
  if(r.error)return fail(r.error==='Not found'?404:r.status,r.error);return[200,await gameView(r.game,u.id)]}],
 // ---- admin (only when ADMIN_TOKEN is set) ----
 'POST /api/admin/invites':[PUB,async({b,req})=>{const t=process.env.ADMIN_TOKEN;if(!t||req.headers['x-admin-token']!==t)return fail(404,'No route');
  const n=Math.min(200,Math.max(1,Number(b.count)||1));return[200,{codes:await S.createInvites(n,b.kind==='premium'?'premium':'pilot',b.note||null)}]}],
};
module.exports={routes,isPremium};
