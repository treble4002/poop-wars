// Follow the Flush screen. Registers R.follow(game, statusText, opponentName) -> HTML.
R.follow=(g,s,opp)=>{const mine=g.res[me.id];
  if(g.status==='done'){const th=g.res[g.players[1-g.me]];return`<div class="card big">${s}<br>You: ${fb(mine)}<br>${esc(opp)}: ${fb(th)}</div>`}
  if(mine)return`<div class="card big">Your run: ${fb(mine)} 🔒<br>Waiting for ${esc(opp)} to play…</div>`;
  if(g.started)return`<div class="card big">You left in the middle of your run, so it ends here.<br><button onclick="follow('${g.id}',1)">Submit my run</button></div>`;
  return`<div class="card big">Watch the pads, then repeat the pattern. It grows each round.<br><b>One try only</b> — don't leave mid-run!<br><button onclick="follow('${g.id}')">Start! 🚽</button></div>`};
const PADS=[['🧻','#e8c547'],['💩','#8e5b34'],['🚽','#4f9bd1'],['🪠','#d0493d']];
async function follow(id,quit){clearInterval(poll);if(quit){try{await api('move',{gameId:id,len:0,ms:0})}catch(e){err(e)}return game(id)}
 let g;try{await api('move',{gameId:id,start:true});g=await api('game?id='+id)}catch(e){return err(e)}
 const seq=g.seq,sl=ms=>new Promise(r=>setTimeout(r,ms));let total=0,len=0;
 $.innerHTML=`<div class="card big" id=ct>Get ready…</div><div class="card pads">${PADS.map((p,i)=>`<div id=pd${i} style="background:${p[1]}">${p[0]}</div>`).join('')}</div>`;
 const pads=PADS.map((_,i)=>document.getElementById('pd'+i)),lit=async(i,ms)=>{pads[i].classList.add('lit');await sl(ms);pads[i].classList.remove('lit')};
 const done=async msg=>{pads.forEach(p=>p.onpointerdown=null);ct.innerHTML=msg+`<br>Pattern: <b>${len}</b> long · ${(total/1000).toFixed(1)}s`;
  try{await api('move',{gameId:id,len,ms:Math.round(total)})}catch(e){err(e)}setTimeout(()=>game(id),2000)};
 await sl(800);
 for(let r=1;r<=seq.length;r++){ct.textContent=`Round ${r} · watch…`;pads.forEach(p=>p.onpointerdown=null);await sl(500);
  const on=Math.max(220,550-r*20);for(let k=0;k<r;k++){await lit(seq[k],on);await sl(140)}
  ct.textContent=`Round ${r} · your turn!`;const t0=performance.now();
  const ok=await new Promise(res=>{let k=0;pads.forEach((p,i)=>p.onpointerdown=e=>{e.preventDefault();lit(i,150);
   if(i!==seq[k]){total+=performance.now()-t0;return res(false)}if(++k===r){total+=performance.now()-t0;res(true)}})});
  if(!ok)return done('💥 Clogged!');len=r}
 done('🏆 You flushed the whole pattern!')}
