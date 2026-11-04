// End-to-end API test. Server must be running. BASE=http://localhost:3737 node test.js
const B=(process.env.BASE||'http://localhost:3737')+'/api/';let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
async function api(p,tok,body,h={}){const r=await fetch(B+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||'',...h},body:body&&JSON.stringify(body)});const j=await r.json();return r.ok?j:{error:j.error,status:r.status}}
const rnd=a=>a[Math.random()*a.length|0];
function legal(g){switch(g.type){
 case'ttt':return{pos:rnd([...g.board.keys()].filter(i=>g.board[i]==null))};
 case'c4':return{pos:rnd([...Array(7).keys()].filter(c=>g.board[c]==null))};
 case'dots':return{pos:rnd([...g.lines.keys()].filter(i=>g.lines[i]==null))};
 case'sink':return g.phase==='setup'?{ships:'random'}:{pos:rnd([...Array(64).keys()].filter(x=>!g.myShots[x]))};
 case'hang':return{letter:rnd('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l=>!g.myGuesses.includes(l)))};
 case'follow':return g.started?{len:0,ms:0}:{start:true}}}
async function playOut(tok,g){g=await api('game?id='+g.id,tok);for(let n=0;n<200&&g.status==='active';n++){if(!g.myTurn)return g;const r=await api('move',tok,{gameId:g.id,...legal(g)});if(r.error)throw Error(r.error);g=r}return g}
(async()=>{
 // ---- accounts, age gate, invites, premium ----
 const inv=await api('admin/invites',null,{count:4,kind:'pilot'},{'x-admin-token':process.env.ADMIN_TOKEN||'test-admin'});
 ok(inv.codes&&inv.codes.length===4,'Admin: generated 4 pilot invite codes');const[ic1,ic2,ic3,ic4]=inv.codes||[];
 ok((await api('signup',null,{name:'NoBox'})).status===400,'Signup without the 13+/rules checkbox rejected on the server');
 ok((await api('signup',null,{name:'Truthy',acceptRules:'yes'})).status===400,'Checkbox must be literally true');
 const teen=await api('signup',null,{name:'Teen',acceptRules:true,inviteCode:ic3});ok(teen.token&&teen.pilot,'Signup with checkbox + pilot invite accepted (no birthdate/parent email)');
 const A=await api('signup',null,{name:'Alice',acceptRules:true,inviteCode:ic1}),Bo=await api('signup',null,{name:'Bob',acceptRules:true,inviteCode:ic2});
 ok(A.premium&&A.pilot&&Bo.pilot,'Pilot invite grants premium + pilot flag');
 ok((await api('signup',null,{name:'Eve',acceptRules:true,inviteCode:ic1})).error,'Invite code is single-use');
 const F=await api('signup',null,{name:'Freddie',acceptRules:true});ok(F.token&&!F.premium,'Signup without invite = free tier');
 const guest=await api('guest',null,{});
 for(const[who,tok]of[['guest',guest.token],['free user',F.token]]){
  ok((await api('circles',tok,{name:'X'})).status===402&&(await api('scores',tok)).status===402&&(await api('trophies',tok)).status===402,`Premium gate: ${who} blocked from circles/scores/trophies`);
  let gg=await api('challenge',tok,{opponentId:'bot',type:'ttt',difficulty:'easy'});gg=await playOut(tok,gg);ok(gg.status==='done',`Free tier: ${who} can play Plunger Pete`)}
 ok(!(await api('leaderboard')).some(x=>x.name==='Guest'),'Guests never on leaderboard');
 const C=await api('circles',A.token,{name:'Fam'});await api('circles/join',Bo.token,{code:C.code});
 const ch=(t,extra={})=>api('challenge',A.token,{circleId:C.id,opponentId:Bo.id,type:t,...extra});
 const mv=(tok,g,b)=>api('move',tok,{gameId:g.id,...b});
 // TTT
 let g=await ch('ttt');for(const[t,p]of[[A,0],[Bo,3],[A,1],[Bo,4],[A,2]])g=await mv(t.token,g,{pos:p});ok(g.winner===A.id,'TTT: Alice wins top row');
 g=await ch('c4');ok((await mv(Bo.token,g,{pos:0})).error==='Not your turn','C4: out-of-turn move rejected');
 for(const[t,p]of[[A,0],[Bo,1],[A,0],[Bo,1],[A,0],[Bo,1],[A,0]])g=await mv(t.token,g,{pos:p});ok(g.winner===A.id,'C4: Alice wins vertical');
 g=await ch('follow');ok(g.seq===undefined,'Follow: pattern hidden before you start');
 ok((await mv(Bo.token,g,{len:3,ms:1500})).error,'Follow: must start before submitting');
 const fb0=await mv(Bo.token,g,{start:true});await mv(Bo.token,g,{len:3,ms:1500});
 g=await api('game?id='+g.id,A.token);ok(g.res[Bo.id]===undefined,'Follow: opponent result hidden until both play');
 g=await mv(A.token,g,{start:true});g=await api('game?id='+g.id,A.token);ok(JSON.stringify(g.seq)===JSON.stringify(fb0.seq)&&g.seq.length===40&&g.seq.every(x=>x>=0&&x<4),'Follow: both players get the same 4-pad pattern');
 ok((await mv(A.token,g,{len:10,ms:500})).error,'Follow: impossibly fast time rejected');
 g=await mv(A.token,g,{len:3,ms:1000});ok(g.winner===A.id,'Follow: same length, faster time wins');
 const g2=await ch('follow'); const fl=await api('leaderboard?type=follow');const al=fl.find(x=>x.id===A.id);ok(al&&al.best&&al.best.len===3&&al.best.ms===1000,'Follow: leaderboard tracks best length + time');
 for(const[d,lo,hi]of[['easy',4,6],['hard',11,14]]){let x=await api('challenge',A.token,{opponentId:'bot',type:'follow',difficulty:d});x=await mv(A.token,x,{start:true});x=await mv(A.token,x,{len:0,ms:0});
  const r=x.res.bot;ok(r&&r.len>=lo&&r.len<=hi&&r.ms>r.len*(r.len+1)/2*250,`Follow: ${d} bot reaches ${r&&r.len} (expected ${lo}-${hi}) with realistic time`)}
 ok((await ch('flush')).error,'Flush Frenzy removed (old type rejected)');
 // Stall Wars: Bob completes box 0 and keeps his turn
 g=await ch('dots');for(const[t,p]of[[A,0],[Bo,20],[A,21]])g=await mv(t.token,g,{pos:p});g=await mv(Bo.token,g,{pos:4});
 ok(g.boxes[0]===1&&g.turn===1,'Stall Wars: completing a stall gives an extra turn');
 ok((await mv(Bo.token,g,{pos:4})).error,'Stall Wars: taken line rejected');
 g=await playOut(Bo.token,g);g=await playOut(A.token,await api('game?id='+g.id,A.token));
 for(let n=0;n<50&&g.status==='active';n++){g=await playOut(A.token,g);g=await playOut(Bo.token,await api('game?id='+g.id,Bo.token))}
 ok(g.status==='done'&&g.boxes.every(x=>x!=null),'Stall Wars: game finishes with all 16 stalls owned');
 // Sink the Stink
 g=await ch('sink');ok((await mv(A.token,g,{ships:[[0,1,2],[8,9,10],[16,17,18],[24,25]]})).error,'Sink: bad placement rejected');
 g=await mv(A.token,g,{ships:[[0,1,2,3],[8,9,10],[16,17,18],[24,25]]});ok(g.phase==='setup'&&!g.myTurn,'Sink: Alice placed, waiting on Bob');
 let gb=await mv(Bo.token,g,{ships:'random'});ok(gb.phase==='play'&&gb.myShips===undefined?false:gb.phase==='play','Sink: Bob random-placed, game on');
 ok(gb.theirShips===undefined&&JSON.stringify(gb).indexOf('"ships"')<0,'Sink: opponent ships hidden');
 g=await api('game?id='+g.id,A.token);for(let n=0;n<70&&g.status==='active';n++){g=await playOut(A.token,g);if(g.status!=='active')break;g=await playOut(Bo.token,await api('game?id='+g.id,Bo.token))}
 ok(g.status==='done'&&g.winner,'Sink: game ends when a fleet is sunk');
 // Hang-Ten TP: Alice sets PLUNGER for Bob
 ok((await ch('hang',{word:'NO WAY'})).error,'Hang: bad custom word rejected');
 g=await ch('hang',{word:'plunger'});gb=await api('game?id='+g.id,Bo.token);ok(gb.mask.join('')==='_______','Hang: Bob sees 7 blanks');
 for(const l of'PLUNGER')gb=await mv(Bo.token,gb,{letter:l});ok(gb.solved&&gb.myMiss===0,'Hang: Bob solves with 0 misses');
 for(const l of'ZQXJKVWY')if(g.status==='active'&&!g.myOver)g=await mv(A.token,g,{letter:l});g=await playOut(A.token,await api('game?id='+g.id,A.token));
 ok(g.status==='done'&&g.winner===Bo.id&&g.theirWord==='PLUNGER','Hang: fewest misses wins, words revealed');
 // Leaderboards
 const lbT=await api('leaderboard?type=ttt');ok(lbT[0]?.name==='Alice'&&lbT[0].w>=1,'Leaderboard per game (ttt)');
 const circ=await api('circle?id='+C.id,A.token);ok(circ.boards.all.length===2&&circ.boards.hang.find(m=>m.name==='Bob').w===1,'Circle per-game + overall boards');
 // Bots
 const before=JSON.stringify((await api('me',A.token)).stats);
 for(const t of['ttt','c4','follow','dots','sink','hang'])for(const d of['easy','hard']){const t0=Date.now();
  let bg=await api('challenge',A.token,{opponentId:'bot',type:t,difficulty:d});bg=await playOut(A.token,bg);
  ok(bg.status==='done',`Bot ${t} ${d}: finished solo (${Date.now()-t0}ms) winner=${bg.winner==='bot'?'bot':bg.winner==='draw'?'draw':'human'}`)}
 let tttLoss=0;for(let i=0;i<6;i++){const bg=await playOut(A.token,await api('challenge',A.token,{opponentId:'bot',type:'ttt',difficulty:'hard'}));if(bg.winner===A.id)tttLoss++}
 ok(tttLoss===0,'Bot TTT hard (minimax) never loses to random play');
 let c4w=0;for(let i=0;i<4;i++){const bg=await playOut(A.token,await api('challenge',A.token,{opponentId:'bot',type:'c4',difficulty:'hard'}));if(bg.winner==='bot')c4w++}
 ok(c4w===4,'Bot C4 hard beats random play 4/4');
 const me=await api('me',A.token);ok(JSON.stringify(me.stats)===before&&me.botStats.all.w+me.botStats.all.l+me.botStats.all.d>=22,'Bot games go to separate vs-Bot record, not main stats');
 ok(!(await api('leaderboard')).some(x=>x.name.includes('Plunger')),'Plunger Pete not on global leaderboard');
 // ---- safe concurrent moves ----
 g=await ch('ttt');const race=await Promise.all([mv(A.token,g,{pos:0}),mv(A.token,g,{pos:1}),mv(A.token,g,{pos:2})]);
 g=await api('game?id='+g.id,A.token);ok(race.filter(r=>!r.error).length===1&&g.board.filter(x=>x!=null).length===1,'Concurrency: 3 simultaneous moves on one turn -> exactly 1 applied');
 g=await ch('follow');await mv(A.token,g,{start:true});await mv(Bo.token,g,{start:true});await new Promise(r=>setTimeout(r,600));
 await Promise.all([mv(A.token,g,{len:2,ms:500}),mv(Bo.token,g,{len:1,ms:300})]);g=await api('game?id='+g.id,A.token);
 ok(g.status==='done'&&g.res[A.id]&&g.res[Bo.id]&&g.winner===A.id,'Concurrency: simultaneous Follow submits both saved (no lost update)');
 // ---- trash talk (presets + 60-char free text), report, block ----
 g=await ch('ttt');
 const tl=await api('taunts');ok(tl.plop,'Preset taunt list served');
 ok((await api('taunt',A.token,{gameId:g.id,key:'you stink lol'})).status===400,'Unknown preset key rejected');
 const tt=await api('taunt',A.token,{gameId:g.id,key:'plop'});const gB=await api('game?id='+g.id,Bo.token);ok(tt.id&&gB.taunts[0].text===tl.plop,'Preset taunt delivered');
 ok((await api('taunt',F.token,{gameId:g.id,key:'plop'})).status===402,'Arena is premium-only');
 ok((await api('report',Bo.token,{userId:A.id,gameId:g.id,tauntId:tt.id,reason:'mean'})).id,'Report a taunt');
 await api('block',Bo.token,{userId:A.id});ok((await api('taunt',A.token,{gameId:g.id,key:'gg'})).status===403&&(await ch('ttt')).status===403,'Block stops taunts and challenges');
 await api('unblock',Bo.token,{userId:A.id});ok(!(await ch('ttt')).error,'Unblock restores challenges');
 // Pages
 const R=B.replace(/\/api\/$/,''),pg=async(p,o)=>{const r=await fetch(R+p,{redirect:'manual',...o});return{s:r.status,t:await r.text(),h:r.headers}};
 { const r=await pg('/rules');ok(r.s===200&&/13 or older/.test(r.t)&&/wiped after each game/.test(r.t)&&/Report abuse/.test(r.t)&&/[Dd]elete your account/.test(r.t),'Rules/privacy page'); const L=await pg('/');ok(/href="\/rules"/.test(L.t),'Footer links rules'); const J=await pg('/js/app.js');ok(/href="\/rules"/.test(J.t)&&/acceptRules/.test(J.t)&&!/birthdate/.test(J.t),'Signup has rules checkbox + link, no birthdate'); }
 { const a=await pg('/');ok(a.s===200&&/Six games/.test(a.t),'Welcome page at /');
  const b=await pg('/play');ok(b.s===200&&/\/js\/app\.js/.test(b.t),'Game app at /play');
  ok((await pg('/play/?invite=AB12')).s===200&&(await pg('/play/circle/x')).s===200,'Deep links under /play serve the app');
  const c=await pg('/index.html');ok(c.s===301&&c.h.get('location')==='/play','Old /index.html redirects to /play');
  ok((await pg('/js/app.js')).s===200&&(await pg('/css/app.css')).s===200&&(await pg('/nope.js')).s===404,'Assets served, missing 404'); }
 console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');process.exit(fails?1:0)})().catch(e=>{console.error('CRASH',e);process.exit(1)});
