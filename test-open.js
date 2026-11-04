// Unit test for OPEN_PREMIUM (in-process, pg-mem). Run: node test-open.js
if(!process.env.TEST_PG)delete process.env.DATABASE_URL;const db=require('./src/db'),S=require('./src/store'),{isPremium}=require('./src/routes');
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{await db.init();const bd='2000-01-01';
 process.env.OPEN_PREMIUM='true';const o=await S.createUser({name:'Open',acceptedRules:true});
 const[code]=await S.createInvites(1,'pilot',null);const p=await S.createUser({name:'Pilot',acceptedRules:true,inviteCode:code});
 let uo=await S.userById(o.id),up=await S.userById(p.id);
 ok(uo.premium_source==='open_pilot'&&isPremium(uo),'OPEN_PREMIUM on: new signup is open_pilot premium');
 ok(up.pilot&&up.premium_source==='invite_pilot'&&isPremium(up),'Invite pilot is tagged invite_pilot');
 process.env.OPEN_PREMIUM='';const late=await S.createUser({name:'Late',acceptedRules:true});
 ok(!isPremium(uo),'OPEN_PREMIUM off: open_pilot user loses premium');ok(isPremium(up),'OPEN_PREMIUM off: invite pilot keeps premium');
 ok(!isPremium(await S.userById(late.id)),'Signup while off is free');
 process.env.OPEN_PREMIUM='1';ok(isPremium(uo),'Turning it back on restores open_pilot users');
 console.log(f?f+' FAILED':'OPEN_PREMIUM ALL PASSED');process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(1)});
