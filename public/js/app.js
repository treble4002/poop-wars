// Core app: API client, router, screens. Game renderers live in js/games/*.js and register on R.
const R={};
let T=localStorage.pwToken,me=null,poll=null,place={};const $=document.getElementById('app');
// Network resilience: network failures and 502/503/504 (deploy restarts, proxy hiccups) are retried with backoff
// while a small "Reconnecting…" toast shows. Moves are versioned on the server, so a retried move can't apply twice:
// if a retried POST comes back 4xx, the first attempt already landed, so we just re-sync instead of showing an error.
let CUR=null,netDown=0;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function toast(msg,ms){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');
 t.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#3b2616;color:#fff;padding:10px 16px;border-radius:14px;font-weight:700;box-shadow:0 4px 14px #0004;z-index:99;max-width:90vw;text-align:center;transition:opacity .2s';document.body.appendChild(t)}
 t.textContent=msg;t.style.opacity='1';t.hidden=false;clearTimeout(t._h);if(ms)t._h=setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.hidden=true,250)},ms)}
const resync=()=>{if(CUR)game(CUR)};
async function api(p,b,{retries=(b&&p!=='move')?0:8}={}){let tried=0;  // only GETs and versioned moves are retried
 for(;;){let r;try{r=await fetch('/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json','x-token':T||''},body:b&&JSON.stringify(b),cache:'no-store'})}catch(e){r=null}
  if(r&&![502,503,504].includes(r.status)){const j=await r.json().catch(()=>({error:'Server hiccup'}));
   if(netDown){netDown=0;toast('Back online ✅',1500);if(p!=='game?id='+CUR)setTimeout(resync,0)}
   if(!r.ok){if(tried&&b&&p==='move'){resync();return{resynced:true}}const e=Error(j.error||'Something went wrong');e.status=r.status;throw e}return j}
  if(tried>=retries){netDown=0;toast(retries?'Still offline. Check your connection and try again.':'Network problem. Please try again.',4000);const e=Error('offline');e.net=true;throw e}
  netDown=1;toast('Reconnecting…');await sleep(Math.min(8000,500*2**tried)+Math.random()*250);tried++}}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');const err=e=>{if(e&&e.net)return;toast('🚫 '+(e&&e.message||'Something went wrong'),3500)};
const G={ttt:{n:'Tic-Tac-Toilet',e:'#️⃣',c:'#8e5b34',d:'3 in a row'},c4:{n:'Connect Four-Flush',e:'🔴',c:'#4f7ea6',d:'Drop 4 in a row'},follow:{n:'Follow the Flush',e:'🚽',c:'#3a9b8f',d:'Memory pattern race'},
 dots:{n:'Stall Wars',e:'🚪',c:'#b0643a',d:'Claim the most stalls'},sink:{n:'Sink the Stink',e:'🦆',c:'#3f6fb5',d:'Find their hidden clogs'},hang:{n:'Hang-Ten TP',e:'🧻',c:'#a04f8f',d:'Guess the word'}};
const SHIPS=[{n:'Mega Clog',e:'💩',s:4},{n:'Rubber Duck',e:'🦆',s:3},{n:'Plunger',e:'🪠',s:3},{n:'TP Roll',e:'🧻',s:2}];
const MK=['🧻','💩'];const fb=b=>`${b.len} long · ${(b.ms/1000).toFixed(1)}s`;const rec=s=>(s?`${s.w}W ${s.l}L ${s.d}D`:'0W 0L 0D')+(s&&s.best?` <small>· best ${fb(s.best)}</small>`:'');
async function go(v,a,b){clearInterval(poll);if(v!=='game')CUR=null;if(QM&&v!=='quick')qmLeave();scrollTo(0,0);try{
 if(!T)return signup();CFG=CFG||await api('config');me=await api('me');document.getElementById('nav').style.display='flex';
 if(v==='circle')return circle(a,b);if(v==='game')return game(a);if(v==='lb')return lb(a);if(v==='pick')return pick(a);if(v==='games')return games();if(v==='quick')return quick(a);home()}catch(e){if(/Sign up/.test(e.message)){T=null;localStorage.removeItem('pwToken');signup()}else err(e)}}
let CFG=null,TICKET=null;
// Deep links: /play?invite=CODE is redeemed silently after signup (never blocks); /play?join=CODE prefills circle join.
const QS=new URLSearchParams(location.search),INVITE=(QS.get('invite')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8),JOIN=(QS.get('join')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
function prefill(){if(INVITE){if(window.rc&&!rc.value)rc.value=INVITE}if(JOIN&&window.cc&&!cc.value)cc.value=JOIN}
new MutationObserver(prefill).observe(document.getElementById('app'),{childList:true});
async function signup(){CFG=CFG||await api('config');
 const guest=`<div class=card><b>Just want to play?</b><br><small>Play Plunger Pete right now, no account needed. Scores are not saved.</small><br><button class=alt onclick="doGuest()">🪠 Play as guest</button></div>`;
 if(CFG.auth==='email-otp'&&!TICKET){$.innerHTML=`<div class="card big">Head-to-head mini games for your bathroom break.</div><div class=card><label>Your email</label><input id=em type=email autocomplete=email><button onclick="sendCode()">Email me a code</button>
  ${INVITE?`<small>🎟️ Invite code <b>${INVITE}</b> will be applied after you confirm your email.</small>`:''}<div id=codebox style="display:none"><label>Code from your email (6–8 digits)</label><input id=oc inputmode=numeric autocomplete=one-time-code maxlength=8 pattern="[0-9]{6,8}" oninput="codeInput(this)"><button onclick="checkCode()">Sign in</button></div></div>${guest}`;return}
 $.innerHTML=`<div class="card big">Head-to-head mini games for your bathroom break.</div><div class=card>
 <label>Silly name</label><input id=n placeholder="e.g. Sir Plops" maxlength=20>

 <label style="display:flex;gap:10px;align-items:flex-start;font-weight:600"><input id=ar type=checkbox style="width:24px;height:24px;flex:none;margin-top:2px"><span>I certify I am 13 or older and agree to the <a href="/rules" target="_blank">Poop Wars rules</a>.</span></label>
 <button onclick="doSignup()">Enter the stall 🚪</button></div>${guest}`}
async function sendCode(){try{await api('auth/start',{email:em.value});codebox.style.display='block'}catch(e){err(e)}}
// Auto-submit: right away at 8 digits; at 6-7 digits after a short pause (Supabase may send 6 or 8).
let codeTimer,codeBusy=false;
function codeInput(el){const d=el.value.replace(/\D/g,'').slice(0,8);if(el.value!==d)el.value=d;clearTimeout(codeTimer);
 if(d.length===8)checkCode();else if(d.length>=6)codeTimer=setTimeout(checkCode,1200)}
async function checkCode(){clearTimeout(codeTimer);const c=oc.value.replace(/\D/g,'');if(!/^\d{6,8}$/.test(c))return alert('Enter the 6 to 8 digit code from your email.');if(codeBusy)return;codeBusy=true;try{const r=await api('auth/verify',{email:em.value,code:c});if(r.token){T=r.token;localStorage.pwToken=T;return go('home')}TICKET=r.ticket;signup()}catch(e){err(e)}finally{codeBusy=false}}
async function doGuest(){try{const u=await api('guest',{});T=u.token;localStorage.pwToken=T;go('home')}catch(e){err(e)}}
async function doSignup(){if(!ar.checked)return alert('Tick the box to confirm you are 13 or older and agree to the rules.');try{const u=await api('signup',{name:n.value,acceptRules:ar.checked,ticket:TICKET||undefined});T=u.token;TICKET=null;localStorage.pwToken=T;if(INVITE){try{await api('redeem',{code:INVITE})}catch(_){}}go('home')}catch(e){err(e)}}
async function redeem(){try{await api('redeem',{code:rc.value});go('home')}catch(e){err(e)}}
function logout(){localStorage.removeItem('pwToken');T=null;go('home')}
async function home(){const gs=await api('games'),turns=gs.filter(g=>g.myTurn).length;
 $.innerHTML=`<div class="card row"><span>Hi <b>${esc(me.name)}</b> 👋<br><small>${me.premium?`Ranked: ${rec(me.stats.all)} · vs 🪠 Bot: ${rec(me.botStats.all)}`:me.kind==='guest'?'Guest · scores not saved':'Free · scores not saved'}</small></span>${turns?`<button onclick="go('games')">👉 ${turns} your turn</button>`:''}</div>
 <h2>🕹️ The Arcade</h2><div class=arcade>${Object.entries(G).map(([k,x])=>`<div class=tile style="background:${x.c}" onclick="go('pick','${k}')"><span>${x.e}</span><b>${x.n}</b><small>${x.d}</small></div>`).join('')}</div>
 ${!me.premium?`<h2>👑 Premium</h2><div class=card>Circles with friends, saved scores, trophies and the trash talk arena are premium.${me.kind==='guest'?`<br><button onclick="logout()">Make an account</button>`:`<input id=rc placeholder="Have an invite code?" maxlength=8 style="text-transform:uppercase"><button onclick="redeem()">Redeem</button>`}</div>`:`
 <h2>👨‍👩‍👧 Your circles</h2>${me.circleList.map(c=>`<div class="card row" onclick="go('circle','${c.id}')"><b>${esc(c.name)}</b><span>Code: ${c.code} ›</span></div>`).join('')||'<div class=card>Make a circle and share the code in your family group chat.</div>'}
 <div class=card><input id=cn placeholder="New circle name (e.g. The Throne Room)"><button onclick="mk()">Create circle</button><hr><input id=cc placeholder="Circle code" maxlength=6 style="text-transform:uppercase"><button class=alt onclick="jn()">Join circle</button></div>`}${me.pilot?'<small class=muted>🧪 Pilot tester: lifetime premium</small>':''}`;
 poll=setInterval(async()=>{const g2=await api('games',null,{retries:2}).catch(()=>null);if(g2&&g2.filter(g=>g.myTurn).length!==turns)home()},6000)}
async function games(){const gs=await api('games');
 $.innerHTML=`<h2>🎮 Your games</h2>${gs.map(g=>`<div class="card row" onclick="go('game','${g.id}')"><span>${G[g.type].e} ${G[g.type].n}<br><small>${g.random?'🎲 ':''}vs ${esc(g.names[1-g.me])}${g.vsBot?' ('+g.diff+')':''}</small></span><b>${g.status==='done'?(g.winner===me.id?'🏆 Won':g.winner==='draw'?'🤝 Draw':'💀 Lost'):g.myTurn?'👉 Your turn':'⏳ Waiting'}</b></div>`).join('')||'<div class=card>No games yet. Pick one in the Arcade!</div>'}`;
 poll=setInterval(async()=>{const g2=await api('games',null,{retries:2}).catch(()=>null);if(g2&&JSON.stringify(g2.map(g=>g.updated))!==JSON.stringify(gs.map(g=>g.updated)))games()},5000)}
function pick(t){const x=G[t];
 $.innerHTML=`<div class="card big" style="background:${x.c};color:#fff"><span style="font-size:50px">${x.e}</span><br><b>${x.n}</b><br><small>${HELP[t]}</small></div>
 <h2>🎲 Quick match</h2><div class=card>${me.kind==='user'?`<button onclick="go('quick','${t}')">🎲 Find a match</button><br><small>Play a random person. Chat is preset taunts and emoji only. Results count on the global rankings.</small>`:`<small>Make a free account to play random opponents.</small>`}</div>
 <h2>🪠 Solo vs Plunger Pete</h2><div class=card><button onclick="ch(null,'bot','${t}','easy')">😌 Easy</button><button onclick="ch(null,'bot','${t}','hard')">😈 Hard</button><br><small>Games vs Plunger Pete go on your separate "vs Bot" record, not the rankings.</small></div>
 ${!me.premium?'<div class=card>⚔️ Challenging friends is a 👑 premium feature.</div>':`<h2>⚔️ Challenge someone</h2>${t==='hang'?`<div class=card><input id=sw maxlength=12 placeholder="Optional: secret word for them (3–12 letters)"><small>Leave blank and we'll pick a random one.</small></div>`:''}
 ${me.circleList.map(c=>`<div class=card><b>${esc(c.name)}</b>${c.members.map(m=>`<div class=row><span>${esc(m.name)}</span><button class=sm onclick="ch('${c.id}','${m.id}','${t}')">Challenge</button></div>`).join('')||'<br><small>Nobody else here yet. Share code <b>'+c.code+'</b></small>'}</div>`).join('')||'<div class=card>Join or create a circle on the Arcade screen to challenge friends.</div>'}`}`}
const HELP={ttt:'Get 3 in a row. 🧻 goes first.',c4:'Drop pieces into columns. First to 4 in a row wins.',follow:'Watch the pads light up, then repeat the pattern. It grows by one each round until you slip. Longest pattern wins; tie goes to the faster fingers. You both get the same pattern.',
 dots:'Take turns drawing walls. Close the 4th wall of a stall to claim it and go again. Most stalls wins.',sink:'Hide your 4 items, then take turns firing at their 8×8 pipes. Sink everything first to win.',
 hang:'Guess your word one letter at a time. Each miss unrolls a sheet of TP (7 sheets). Fewest misses wins.'};
async function mk(){try{const c=await api('circles',{name:cn.value||'My Circle'});go('circle',c.id)}catch(e){err(e)}}
async function jn(){try{const c=await api('circles/join',{code:cc.value});go('circle',c.id)}catch(e){err(e)}}
async function circle(id,tab='all'){const c=await api('circle?id='+id),rows=c.boards[tab];
 $.innerHTML=`<div class="card big"><b>${esc(c.name)}</b><br>Invite code: <b style="font-size:28px;letter-spacing:3px">${c.code}</b><br><button class=alt onclick="navigator.clipboard&&navigator.clipboard.writeText('Join my Poop Wars circle! Code: ${c.code} — '+location.origin+'/play?join=${c.code}');this.textContent='Copied!'">📋 Copy invite</button></div>
 <h2>👑 Circle leaders</h2><div class=card>${Object.keys(G).map(t=>{const top=c.boards[t][0];return top&&top.w?`<div class=row><span>${G[t].e} ${G[t].n}</span><b>${esc(top.name)} (${top.w}W)</b></div>`:''}).join('')||'<small>No games finished yet.</small>'}</div>
 <h2>🏆 Rankings</h2><div class=tabs>${['all',...Object.keys(G)].map(t=>`<button class="sm ${t===tab?'on':'alt'}" onclick="go('circle','${id}','${t}')">${t==='all'?'Overall':G[t].e+' '+G[t].n}</button>`).join('')}</div>
 <div class=card>${rows.map((m,i)=>`<div class=row><span>${['👑','🥈','🥉'][i]||'🧻'} ${esc(m.name)}${m.id===me.id?' <small>(you)</small>':''}</span><span>${rec(m)}</span></div>`).join('')}</div>
 <small>To challenge someone, pick a game in the 🕹️ Arcade.</small>`}
async function lb(tab='all'){const l=await api('leaderboard?type='+tab);
 $.innerHTML=`<h2>🌍 Global Throne Rankings</h2><div class=tabs>${['all',...Object.keys(G)].map(t=>`<button class="sm ${t===tab?'on':'alt'}" onclick="go('lb','${t}')">${t==='all'?'Overall':G[t].e+' '+G[t].n}</button>`).join('')}</div>
 <div class=card>${l.map((x,i)=>`<div class=row><span>${['👑','🥈','🥉'][i]||(i+1)+'.'} ${esc(x.name)}</span><span>${rec(x)}</span></div>`).join('')||'Nobody has played this yet.'}</div>
 <div class=card><b>Your vs 🪠 Plunger Pete record</b>${Object.keys(G).map(t=>`<div class=row><span>${G[t].e} ${G[t].n}</span><span>${rec(me.botStats[t])}</span></div>`).join('')}</div>`}
async function ch(c,o,t,d){try{const w=window.sw&&sw.value.trim();const g=await api('challenge',{circleId:c,opponentId:o,type:t,difficulty:d,word:t==='hang'&&o!=='bot'?w:undefined});go('game',g.id)}catch(e){err(e)}}
async function mv(id,b){try{await api('move',{gameId:id,...b});game(id)}catch(e){err(e)}}
async function game(id){CUR=id;const g=await api('game?id='+id),opp=esc(g.names[1-g.me]),x=G[g.type];
 let res=g.status!=='done'?'':g.winner===me.id?'🏆 You won! Flush with pride.':g.winner==='draw'?'🤝 Draw. Nobody flushed.':'💀 You lost. Wipe away the tears.';
 let h=`<div class="card big" style="background:${x.c};color:#fff"><b>${x.e} ${x.n}</b><br>You ${MK[g.me]} vs ${opp} ${MK[1-g.me]}${g.vsBot?' · '+g.diff:''}${g.random?'<br><small>🎲 Quick match</small>':''}</div>`;
 const status=res||(g.myTurn?'👉 Your turn!':'⏳ Waiting for '+opp+'… (auto-refreshing)');
 h+=(R[g.type]||(()=>''))(g,status,opp);
 if(!g.vsBot&&(g.random||me.premium))h+=arena(g);
 if(g.status==='done')h+=g.random?`<button onclick="go('quick','${g.type}')">🎲 New quick match</button> <button class=alt onclick="go('home')">🕹️ Arcade</button>`:`<button onclick="ch(${g.circleId?`'${g.circleId}'`:null},'${g.players[1-g.me]}','${g.type}','${g.diff||''}')">🔁 Rematch</button> <button class=alt onclick="go('home')">🕹️ Arcade</button>`;
 $.innerHTML=h;if(g.status==='active')poll=setInterval(async()=>{const g2=await api('game?id='+id,null,{retries:2}).catch(()=>null);if(g2&&g2.updated!==g.updated)game(id)},3000)}

// Trash talk arena: preset taunts + short free text (60 chars, filtered on the server), with report + block. Wiped when the game ends.
function arena(g){const opp=g.players[1-g.me],T2=CFG&&CFG.taunts||{},EM=CFG&&CFG.emoji||{};
 return`<h2>🗯️ Trash talk</h2>${g.status==='done'?'<div class=card>Game over. Trash talk is wiped. GG! 🤝</div>':`${g.freeText?'':`<small class=muted>${g.random?'🎲 Quick match: preset taunts and emoji only.':'Preset taunts only.'}</small>`}<div class="card emoji">${Object.entries(EM).map(([k,e])=>`<button class="alt sm" aria-label="send ${e}" onclick="taunt('${g.id}','${k}')">${e}</button>`).join('')}</div>`+(!g.freeText?'':`<form class="card row" onsubmit="event.preventDefault();say('${g.id}',this.t)"><input name=t maxlength=60 placeholder="Say something (60 max, keep it clean)" style="flex:1;min-width:0" autocomplete=off><button class=sm>Send</button></form>`)}${g.status==='done'?'':`<div class="card taunts">${Object.entries(T2).map(([k,t])=>`<button class="alt" onclick="taunt('${g.id}','${k}')">${esc(t)}</button>`).join('')}</div>`}
 <div class=card>${(g.taunts||[]).map(t=>`<div class=row><span>${t.from===me.id?'You':esc(g.names[1-g.me])}: ${esc(t.text)}</span>${t.from!==me.id?`<button class="sm alt" onclick="report('${opp}','${g.id}',${t.id})">🚩</button>`:''}</div>`).join('')||'<small class=muted>No trash talk yet.</small>'}
 <br><button class="sm alt" onclick="report('${opp}','${g.id}')">🚩 Report player</button><button class="sm alt" onclick="blockP('${opp}')">⛔ Block</button></div>`}
async function say(id,el){const t=el.value.trim();if(!t)return;try{await api('taunt',{gameId:id,text:t});el.value='';game(id)}catch(e){err(e)}}
async function taunt(id,k){try{await api('taunt',{gameId:id,key:k});game(id)}catch(e){err(e)}}
async function report(u,g,t){if(!confirm('Report this player to the grown-ups who run Poop Wars?'))return;try{await api('report',{userId:u,gameId:g,tauntId:t,reason:'mean'});alert('Thanks. We will take a look.')}catch(e){err(e)}}
async function blockP(u){if(!confirm('Block this player? They cannot challenge or taunt you.'))return;try{await api('block',{userId:u});go('home')}catch(e){err(e)}}

// ---- Quick match: join the queue, poll every ~1.5s, cancel on leave. After 30s offer Plunger Pete (you stay queued meanwhile).
let QM=null;
async function quick(t){const x=G[t];QM={t,start:Date.now()};
 $.innerHTML=`<div class="card big searching" style="background:${x.c};color:#fff"><div class=spin>🚽</div><br><b>Searching…</b><br>${x.e} ${x.n}<br><small>Looking for a random opponent · <span id=qs>0s</span></small></div>
 <div class=card id=qbot style="display:none"><b>Nobody yet 😴</b><br><small>Play Plunger Pete now (that leaves the queue), or keep waiting here. You stay in line.</small><br><button onclick="qmBot('${t}')">🪠 Play Plunger Pete instead</button></div>
 <button class=alt onclick="go('pick','${t}')">✖ Cancel</button><br><small class=muted>Random players only see your display name. Chat is preset taunts and emoji.</small>`;
 const done=r=>{if(r&&r.gameId){QM=null;clearInterval(poll);toast('Match found! 🎉',1500);go('game',r.gameId);return true}};
 try{if(done(await api('match/join',{type:t})))return}catch(e){QM=null;return err(e)}
 let busy=false;poll=setInterval(async()=>{if(!QM||busy)return;const s=Math.round((Date.now()-QM.start)/1000);const qs=document.getElementById('qs');if(qs)qs.textContent=s+'s';
  if(s>=30){const qb=document.getElementById('qbot');if(qb)qb.style.display='block'}
  busy=true;try{let r=await api('match/poll',null,{retries:2});if(r.gone&&QM)r=await api('match/join',{type:t});if(QM)done(r)}catch(e){}finally{busy=false}},1500)}
function qmLeave(){QM=null;api('match/cancel',{}).then(r=>{if(r&&r.gameId)toast('You were matched just as you left. Find it in 🎮 Games.',4000)}).catch(()=>{})}
async function qmBot(t){QM=null;clearInterval(poll);await api('match/cancel',{}).catch(()=>null);ch(null,'bot',t,'easy')}
