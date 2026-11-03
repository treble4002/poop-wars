// End-to-end API test. Server must be running. BASE=http://localhost:3737 node test.js
const B=(process.env.BASE||'http://localhost:3737')+'/api/';let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
async function api(p,tok,body){const r=await fetch(B+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||''},body:body&&JSON.stringify(body)});const j=await r.json();return r.ok?j:{error:j.error,status:r.status}}
const rnd=a=>a[Math.random()*a.length|0];
function legal(g){switch(g.type){
 case'ttt':return{pos:rnd([...g.board.keys()].filter(i=>g.board[i]==null))};
 case'c4':return{pos:rnd([...Array(7).keys()].filter(c=>g.board[c]==null))};
 case'dots':return{pos:rnd([...g.lines.keys()].filter(i=>g.lines[i]==null))};
 case'sink':return g.phase==='setup'?{ships:'random'}:{pos:rnd([...Array(64).keys()].filter(x=>!g.myShots[x]))};
 case'hang':return{letter:rnd('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l=>!g.myGuesses.includes(l)))};
 case'flush':return{ms:5000}}}
async function playOut(tok,g){for(let n=0;n<200&&g.status==='active';n++){if(!g.myTurn){g=await api('game?id='+g.id,tok);continue}const r=await api('move',tok,{gameId:g.id,...legal(g)});if(r.error)throw Error(r.error);g=r}return g}
(async()=>{
 const A=await api('signup',null,{name:'Alice'}),Bo=await api('signup',null,{name:'Bob'});
 const C=await api('circles',A.token,{name:'Fam'});await api('circles/join',Bo.token,{code:C.code});
 const ch=(t,extra={})=>api('challenge',A.token,{circleId:C.id,opponentId:Bo.id,type:t,...extra});
 const mv=(tok,g,b)=>api('move',tok,{gameId:g.id,...b});
 // TTT
 let g=await ch('ttt');for(const[t,p]of[[A,0],[Bo,3],[A,1],[Bo,4],[A,2]])g=await mv(t.token,g,{pos:p});ok(g.winner===A.id,'TTT: Alice wins top row');
 g=await ch('c4');ok((await mv(Bo.token,g,{pos:0})).error==='Not your turn','C4: out-of-turn move rejected');
 for(const[t,p]of[[A,0],[Bo,1],[A,0],[Bo,1],[A,0],[Bo,1],[A,0]])g=await mv(t.token,g,{pos:p});ok(g.winner===A.id,'C4: Alice wins vertical');
 g=await ch('flush');await mv(Bo.token,g,{ms:6000});g=await api('game?id='+g.id,A.token);ok(g.scores[Bo.id]===undefined,'Flush: opponent time hidden until both play');
 g=await mv(A.token,g,{ms:5000});ok(g.winner===A.id,'Flush: faster wins');
 ok((await mv(A.token,await ch('flush'),{ms:200})).error,'Flush: impossible time rejected');
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
 for(const t of['ttt','c4','flush','dots','sink','hang'])for(const d of['easy','hard']){const t0=Date.now();
  let bg=await api('challenge',A.token,{opponentId:'bot',type:t,difficulty:d});bg=await playOut(A.token,bg);
  ok(bg.status==='done',`Bot ${t} ${d}: finished solo (${Date.now()-t0}ms) winner=${bg.winner==='bot'?'bot':bg.winner==='draw'?'draw':'human'}`)}
 let tttLoss=0;for(let i=0;i<6;i++){const bg=await playOut(A.token,await api('challenge',A.token,{opponentId:'bot',type:'ttt',difficulty:'hard'}));if(bg.winner===A.id)tttLoss++}
 ok(tttLoss===0,'Bot TTT hard (minimax) never loses to random play');
 let c4w=0;for(let i=0;i<4;i++){const bg=await playOut(A.token,await api('challenge',A.token,{opponentId:'bot',type:'c4',difficulty:'hard'}));if(bg.winner==='bot')c4w++}
 ok(c4w===4,'Bot C4 hard beats random play 4/4');
 const me=await api('me',A.token);ok(JSON.stringify(me.stats)===before&&me.botStats.all.w+me.botStats.all.l+me.botStats.all.d>=22,'Bot games go to separate vs-Bot record, not main stats');
 ok(!(await api('leaderboard')).some(x=>x.name.includes('Plunger')),'Plunger Bot not on global leaderboard');
 console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');process.exit(fails?1:0)})().catch(e=>{console.error('CRASH',e);process.exit(1)});
