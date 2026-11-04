// Trash talk unit/integration test (in-process, pg-mem; TEST_PG=1 uses DATABASE_URL). Run: node test-talk.js
if(!process.env.TEST_PG)delete process.env.DATABASE_URL;delete process.env.SUPABASE_URL;process.env.TALK_GAP_MS='400';
const db=require('./src/db'),S=require('./src/store'),F=require('./src/filter'),{create}=require('./src/http');
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};const zz=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await db.init();await S.ensureBot();process.env.OPEN_PREMIUM='true';
 const srv=create().listen(0);const B=`http://localhost:${srv.address().port}/api/`;
 const api=async(p,tok,body)=>{const r=await fetch(B+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||''},body:body&&JSON.stringify(body)});const j=await r.json();return r.ok?j:{error:j.error,status:r.status}};
 const su=n=>api('signup',null,{name:n,birthdate:'2000-01-01'});const A=await su('Ann'+Date.now()%1e5),Bo=await su('Bob'+Date.now()%1e5);
 ok(A.premium&&Bo.premium,'Both players premium (open pilot)');
 const c=await api('circles',A.token,{name:'Talkers'});await api('circles/join',Bo.token,{code:c.code});
 const ch=()=>api('challenge',A.token,{type:'ttt',opponentId:Bo.id,circleId:c.id});
 let g=await ch();ok(g.id,'Game started');
 // filter unit
 ok(F.check('you are a sh1t player').text.includes('s***'),'Swear masked (leetspeak)');ok(!F.check('n1gg3r').ok&&!F.check('k y s').ok,'Slurs/self-harm rejected');
 ok(F.check('get flushed nerd').text==='get flushed nerd','Clean text untouched');
 // free text
 const t1=await api('taunt',A.token,{gameId:g.id,text:'  get   flushed nerd  '});ok(t1.id&&t1.text==='get flushed nerd','Free text accepted + trimmed');
 ok((await api('taunt',A.token,{gameId:g.id,text:'again'})).status===429,'Rate limit: second message inside window blocked');await zz(450);
 ok((await api('taunt',A.token,{gameId:g.id,text:'x'.repeat(61)})).status===400,'61 chars rejected (server cap)');await zz(450);
 ok((await api('taunt',A.token,{gameId:g.id,text:'💩'.repeat(60)})).id,'60 emoji chars ok');await zz(450);
 const m=await api('taunt',A.token,{gameId:g.id,text:'what the fuck'});ok(m.text&&!/fuck/i.test(m.text),'Profanity masked on server');await zz(450);
 ok((await api('taunt',A.token,{gameId:g.id,text:'retard'})).status===400,'Slur rejected');
 ok((await api('taunt',A.token,{gameId:g.id,text:'   '})).status===400,'Empty rejected');
 const p=await api('taunt',Bo.token,{gameId:g.id,key:'plop'});ok(p.id,'Preset still works');
 let gv=await api('game?id='+g.id,Bo.token);ok(gv.taunts.some(t=>t.text==='get flushed nerd'),'Opponent sees free text');
 // report copies message
 const r=await api('report',Bo.token,{userId:A.id,gameId:g.id,tauntId:t1.id,reason:'mean'});ok(r.id&&(await S.reportById(r.id)).message==='get flushed nerd','Report keeps a copy of the message');
 const r2=await api('report',A.token,{userId:Bo.id,gameId:g.id,tauntId:t1.id,reason:'mean'});ok(r2.id&&(await S.reportById(r2.id)).message===null,'Cannot copy someone else\'s message by id');
 // finish -> wipe
 for(const[t,pos]of[[A,0],[Bo,3],[A,1],[Bo,4],[A,2]])await api('move',t.token,{gameId:g.id,pos});
 g=await api('game?id='+g.id,A.token);ok(g.status==='done','Game finished');
 ok(!(await db.one('SELECT count(*)::int AS n FROM taunts WHERE game_id=$1',[g.id])).n,'Taunts wiped when game finishes');
 ok((await S.reportById(r.id)).message==='get flushed nerd','Reported copy survives the wipe');
 ok((await api('taunt',A.token,{gameId:g.id,text:'hi'})).status===400,'No talk after game over');
 // 24h sweep
 const g2=await ch();await zz(450);const old=await api('taunt',A.token,{gameId:g2.id,key:'gg'});
 await db.q('UPDATE taunts SET created_at=$1 WHERE id=$2',[new Date(Date.now()-25*3600e3),old.id]);
 ok(!(await api('game?id='+g2.id,Bo.token)).taunts.length,'Stale (>24h) taunts hidden');await S.sweepTaunts();
 ok(!(await db.one('SELECT count(*)::int AS n FROM taunts WHERE id=$1',[old.id])).n,'Stale taunts swept');
 // block still works; premium-only
 await api('block',Bo.token,{userId:A.id});await zz(450);ok((await api('taunt',A.token,{gameId:g2.id,text:'yo'})).status===403,'Block stops free text');
 srv.close();console.log(f?f+' FAILED':'TALK ALL PASSED');process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(1)});
