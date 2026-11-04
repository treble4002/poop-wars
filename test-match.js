// Quick match tests. Server must be running (BASE, default :3737) with ADMIN_TOKEN (default test-admin).
const B=(process.env.BASE||'http://localhost:3737')+'/api/';let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
const zz=ms=>new Promise(r=>setTimeout(r,ms));
async function api(p,tok,body,h={}){const r=await fetch(B+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||'',...h},body:body&&JSON.stringify(body)});const j=await r.json();if(j&&typeof j==='object'&&!Array.isArray(j))j.status=j.status??r.status;j._s=r.status;return j}
let n=0;const su=async(name,inviteCode)=>{const u=await api('signup',null,{name:name+(++n)+'_'+(Date.now()%1e5),acceptRules:true,inviteCode});return u};
// poll everybody until each has a game or attempts run out
async function settle(us,rounds=12){const got={};for(let i=0;i<rounds;i++){await Promise.all(us.filter(u=>!got[u.id]).map(async u=>{const r=await api('match/poll',u.token);if(r.gameId)got[u.id]=r.gameId}));await zz(30)}return got}
(async()=>{
 // access
 const gst=await api('guest',null,{});ok((await api('match/join',gst.token,{type:'ttt'}))._s===403,'Guests cannot quick match');
 const a0=await su('Q');ok((await api('match/join',a0.token,{type:'nope'}))._s===400,'Bad game type rejected');
 const solo=await api('match/join',a0.token,{type:'c4'});ok(solo.waiting,'Alone in queue: waiting (free, non-premium account allowed)');
 ok((await api('match/poll',a0.token)).waiting,'Poll keeps you waiting; never matched with yourself');
 const cx=await api('match/cancel',a0.token,{}),px=await api('match/poll',a0.token);if(process.env.DBG)console.log(cx,px);ok(cx.ok&&px.gone,'Cancel removes you from the queue');
 // concurrency: two people joining at the same instant -> exactly one pair, 25 times
 let pairs=0,games=new Set();for(let i=0;i<25;i++){const[x,y]=await Promise.all([su('Px'),su('Py')]);
  const rs=await Promise.all([api('match/join',x.token,{type:'dots'}),api('match/join',y.token,{type:'dots'})]);const got=await settle([x,y].filter((u,k)=>!rs[k].gameId));
  const gx=rs[0].gameId||got[x.id],gy=rs[1].gameId||got[y.id];if(gx&&gx===gy){pairs++;games.add(gx)}}
 ok(pairs===25&&games.size===25,`Simultaneous joins: ${pairs}/25 made exactly one shared game`);
 // 12 at once -> 6 games, everyone in exactly one, nobody with themselves
 const many=await Promise.all(Array.from({length:12},()=>su('M')));const first=await Promise.all(many.map(u=>api('match/join',u.token,{type:'hang'})));
 const got=await settle(many.filter((u,k)=>!first[k].gameId),20);const gid=many.map((u,k)=>first[k].gameId||got[u.id]);
 const by={};gid.forEach((g,k)=>{if(g)(by[g]=by[g]||[]).push(many[k].id)});
 ok(gid.every(Boolean)&&Object.keys(by).length===6&&Object.values(by).every(p=>p.length===2&&p[0]!==p[1]),'12 concurrent joins: 6 games, each player in exactly one');
 let allPlayersOk=true;for(const[g,ps]of Object.entries(by)){const v=await api('game?id='+g,many.find(u=>u.id===ps[0]).token);if(!(v.random&&v.players.slice().sort().join()===ps.slice().sort().join()))allPlayersOk=false}
 ok(allPlayersOk,'Matched games are random games between exactly those two players');
 // different game types never match
 const[t1,t2]=await Promise.all([su('T'),su('T')]);await api('match/join',t1.token,{type:'ttt'});const r2=await api('match/join',t2.token,{type:'sink'});
 ok(r2.waiting&&(await api('match/poll',t1.token)).waiting,'Different games do not match');await api('match/cancel',t1.token,{});await api('match/cancel',t2.token,{});
 // blocks
 const[b1,b2,b3]=await Promise.all([su('Bk'),su('Bk'),su('Bk')]);await api('block',b1.token,{userId:b2.id});
 await api('match/join',b1.token,{type:'follow'});const rb=await api('match/join',b2.token,{type:'follow'});
 ok(rb.waiting&&(await api('match/poll',b1.token)).waiting,'Blocked pair is never matched (either direction)');
 const rb3=await api('match/join',b3.token,{type:'follow'});ok(!!rb3.gameId,'A third person is matched with the first one waiting');
 await api('match/cancel',b1.token,{});await api('match/cancel',b2.token,{});
 // stale entries expire (server runs with MATCH_STALE_MS small in test.sh)
 const stale=Number(process.env.MATCH_STALE_MS||0);if(stale){const[s1,s2]=await Promise.all([su('St'),su('St')]);await api('match/join',s1.token,{type:'c4'});await zz(stale+300);
  const rs2=await api('match/join',s2.token,{type:'c4'});ok(rs2.waiting,'Stale queue entry (no poll) is expired, not matched');ok((await api('match/poll',s1.token)).gone,'Stale user is told they left the queue');await api('match/cancel',s2.token,{})}
 // privacy + chat rules in a random game
 const[c1,c2]=await Promise.all([su('Chat'),su('Chat')]);await api('match/join',c1.token,{type:'ttt'});const m=await api('match/join',c2.token,{type:'ttt'});
 let g=await api('game?id='+m.gameId,c2.token);ok(g.random&&!g.freeText&&g.names.every(x=>/^Chat/.test(x))&&!/email|@/.test(JSON.stringify(g)),'Random game shows display names only, no emails');
 ok((await api('taunt',c1.token,{gameId:g.id,text:'hello there'}))._s===400,'Free text rejected in quick-match games');
 const tk=await api('taunt',c1.token,{gameId:g.id,key:'plop'});ok(tk._s===200,'Preset taunt allowed in quick match (non-premium)');
 const em=await api('taunt',c2.token,{gameId:g.id,key:'e:fire'});ok(em._s===200&&em.text==='🔥','Preset emoji reaction allowed');
 ok((await api('taunt',c2.token,{gameId:g.id,key:'e:nope'}))._s===400,'Unknown emoji key rejected');
 const rep=await api('report',c2.token,{userId:c1.id,gameId:g.id,tauntId:tk.id,reason:'mean'});ok(rep._s===200,'Report works in quick match');
 // play it out -> counts on the global board
 for(let i=0;i<20&&g.status==='active';i++){const who=g.myTurn?c2:c1;const v=await api('game?id='+g.id,who.token);if(!v.myTurn){g=await api('game?id='+g.id,c2.token);continue}
  const p=v.board.findIndex(x=>x==null);g=await api('move',who.token,{gameId:g.id,pos:p});g=await api('game?id='+g.id,c2.token)}
 ok(g.status==='done','Quick-match game finished');const lb=await api('leaderboard?type=ttt');ok(Array.isArray(lb)&&lb.some(x=>x.id===c1.id||x.id===c2.id),'Quick-match result counts on the global per-game leaderboard');
 ok((await api('game?id='+g.id,c1.token)).taunts.length===0,'Chat wiped when the quick-match game ends');
 // block in a random game stops chat
 const[d1,d2]=await Promise.all([su('D'),su('D')]);await api('match/join',d1.token,{type:'c4'});const md=await api('match/join',d2.token,{type:'c4'});
 await api('block',d1.token,{userId:d2.id});ok((await api('taunt',d2.token,{gameId:md.gameId,key:'gg'}))._s===403,'Block works in quick match (taunts stop)');
 // circle games keep free text
 const inv=await api('admin/invites',null,{count:2,kind:'pilot'},{'x-admin-token':process.env.ADMIN_TOKEN||'test-admin'});
 const p1=await su('Circ',inv.codes[0]),p2=await su('Circ',inv.codes[1]);const c=await api('circles',p1.token,{name:'Fam'});await api('circles/join',p2.token,{code:c.code});
 const cg=await api('challenge',p1.token,{circleId:c.id,opponentId:p2.id,type:'ttt'});ok(cg.freeText&&!cg.random,'Circle game allows free text');
 ok((await api('taunt',p1.token,{gameId:cg.id,text:'you are going down'}))._s===200,'Free-text trash talk works between circle members');
 ok((await api('taunt',p2.token,{gameId:cg.id,key:'e:poop'}))._s===200,'Emoji also available in circle games');
 await api('circles/leave',p2.token,{circleId:c.id});await zz(3100);ok((await api('taunt',p1.token,{gameId:cg.id,text:'still there?'}))._s===400,'Free text stops once they no longer share the circle');
 console.log(f?f+' FAILED':'MATCH ALL PASSED');process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(1)});
