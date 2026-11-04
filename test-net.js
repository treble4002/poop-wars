// Frontend network resilience (headless browser). Server must be running (BASE, default :3737). Needs puppeteer: PUPPETEER=/path/to/node_modules/puppeteer node test-net.js
// Skips (exit 0) when puppeteer isn't available.
let P;try{P=require(process.env.PUPPETEER||'puppeteer')}catch(e){console.log('SKIP test-net (no puppeteer)');process.exit(0)}
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};const zz=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const U=process.env.BASE||'http://localhost:3737';
 const api=async(p,tok,b)=>(await fetch(U+'/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json','x-token':tok||''},body:b&&JSON.stringify(b)})).json();
 const gst=await api('guest',null,{});let g=await api('challenge',gst.token,{opponentId:'bot',type:'dots',difficulty:'easy'});
 const b=await P.launch({args:['--no-sandbox'],executablePath:process.env.CHROME||'/usr/bin/google-chrome'});const pg=await b.newPage();const dialogs=[];pg.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
 await pg.goto(U+'/play');await pg.evaluate(t=>localStorage.pwToken=t,gst.token);await pg.goto(U+'/play');await zz(500);
 await pg.evaluate(id=>go('game',id),g.id);await zz(500);
 let drop=0,lateApply=null,seenToast=false;await pg.setRequestInterception(true);
 pg.on('request',async r=>{if(r.url().includes('/api/move')&&drop>0){drop--;if(lateApply){const m=lateApply;lateApply=null;await api('move',gst.token,m)}return r.abort('internetdisconnected')}r.continue()});
 const watch=setInterval(async()=>{try{const t=await pg.$eval('#toast',e=>e.hidden?'':e.textContent);if(/Reconnecting/.test(t))seenToast=true}catch(e){}},100);
 const free=v=>[...v.lines.keys()].filter(i=>v.lines[i]==null);
 // 1) two dropped requests, third gets through
 let v=await api('game?id='+g.id,gst.token);const p1=free(v)[0];drop=2;await pg.evaluate((id,p)=>mv(id,{pos:p}),g.id,p1);
 v=await api('game?id='+g.id,gst.token);ok(v.lines[p1]===0,'Move retried after network drops and applied');ok(seenToast,'"Reconnecting…" toast shown');ok(!dialogs.length,'No alert() popup');
 await zz(300);let dom=await pg.evaluate(()=>document.getElementById('app').innerHTML.length);ok(dom>200,'Game re-rendered');
 // 2) request reaches the server but the response is lost -> retry gets "Line taken" -> silent re-sync
 v=await api('game?id='+g.id,gst.token);if(v.status==='active'&&v.myTurn){const p2=free(v)[0];drop=1;lateApply={gameId:g.id,pos:p2};const r=await pg.evaluate((id,p)=>mv(id,{pos:p}),g.id,p2);
  v=await api('game?id='+g.id,gst.token);ok(v.lines[p2]===0,'Lost-response move counted once');ok(!dialogs.length,'Duplicate retry re-synced silently (no alert)');
  const up=await pg.evaluate(()=>document.querySelectorAll('#app *').length);ok(up>20,'Board re-synced after reconnect')}
 // 3) a game error is a toast, not an alert
 await pg.evaluate(id=>mv(id,{pos:999}),g.id);await zz(200);const t=await pg.$eval('#toast',e=>e.textContent);ok(/🚫/.test(t)&&!dialogs.length,'Game errors shown as toast');
 clearInterval(watch);await b.close();console.log(f?f+' FAILED':'NET ALL PASSED');process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(1)});
