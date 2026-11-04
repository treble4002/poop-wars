// Sink the Stink screen. Registers R.sink(game, statusText, opponentName) -> HTML.
R.sink=(g,s,opp)=>{if(g.phase==='setup'&&!g.myShips)return placeUI(g);if(g.phase==='setup')return`<div class="card big">Your stuff is hidden 🤫<br>Waiting for ${opp} to hide theirs…</div>`;
  const sunk={};(g.sunkTheirs||[]).forEach(x=>x.cells.forEach(c=>sunk[c]=SHIPS[x.k].e));const their={};(g.theirShips||[]).forEach((c,k)=>c.forEach(y=>their[y]=SHIPS[k].e));
  const mine={};g.myShips.forEach((c,k)=>c.forEach(y=>mine[y]=SHIPS[k].e));const ls=g.lastShot;
  const msg=ls?`${ls.by===g.me?'You':opp} ${ls.result==='miss'?'missed 💧':ls.result==='hit'?'hit something 💥':'SANK the '+SHIPS[ls.ship].n+' '+SHIPS[ls.ship].e}`:'';
  return`<div class="card big">${s}<br><small>${msg}</small></div><h2>🎯 Their pipes</h2><div class="sea">${[...Array(64).keys()].map(i=>{const v=g.myShots[i];
   return`<div class="${!v&&g.myTurn?'tap':''}" ${!v&&g.myTurn?`onclick="mv('${g.id}',{pos:${i}})"`:''}>${sunk[i]||(v==='hit'?'💥':v==='miss'?'💧':their[i]?'<small style=opacity:.5>'+their[i]+'</small>':'')}</div>`}).join('')}</div>
   <small>Sunk: ${(g.sunkTheirs||[]).map(x=>SHIPS[x.k].e+' '+SHIPS[x.k].n).join(', ')||'nothing yet'}</small>
   <h2>🚽 Your pipes</h2><div class="sea small">${[...Array(64).keys()].map(i=>{const v=g.theirShots[i];return`<div class="${mine[i]?'ship':''}">${v==='hit'?'💥':v==='miss'?'💧':mine[i]||''}</div>`}).join('')}</div>`};
// Sink the Stink placement
function randShips(){for(;;){const used=new Set(),out=[];let ok=true;for(const{s:n}of SHIPS){let p=false;for(let t=0;t<100&&!p;t++){const h=Math.random()<.5,r=Math.random()*(h?8:9-n)|0,c=Math.random()*(h?9-n:8)|0;
 const cells=Array.from({length:n},(_,i)=>h?r*8+c+i:(r+i)*8+c);if(cells.every(x=>!used.has(x))){cells.forEach(x=>used.add(x));out.push(cells);p=true}}if(!p){ok=false;break}}if(ok)return out}}
function placeUI(g){const p=place[g.id]=place[g.id]||{ships:[],h:true},next=SHIPS[p.ships.length],own={};p.ships.forEach((c,k)=>c.forEach(y=>own[y]=SHIPS[k].e));
 return`<div class="card big">Hide your stuff in the pipes!<br>${next?`Tap where the <b>${next.e} ${next.n}</b> (${next.s} long) starts`:'All hidden. Ready?'}</div>
 <div class="sea">${[...Array(64).keys()].map(i=>`<div class="tap ${own[i]?'ship':''}" onclick="putShip('${g.id}',${i})">${own[i]||''}</div>`).join('')}</div>
 <button class=alt onclick="place['${g.id}'].h=!place['${g.id}'].h;game('${g.id}')">↻ ${p.h?'Sideways':'Up-down'}</button><button class=alt onclick="place['${g.id}'].ships=randShips();game('${g.id}')">🎲 Random</button><button class=alt onclick="place['${g.id}'].ships=[];game('${g.id}')">Clear</button>
 ${p.ships.length===4?`<button onclick="mv('${g.id}',{ships:place['${g.id}'].ships})">✅ Lock it in</button>`:''}`}
function putShip(id,i){const p=place[id],n=SHIPS[p.ships.length];if(!n)return;const r=i>>3,c=i&7;if(p.h?c+n.s>8:r+n.s>8)return alert('Doesn’t fit there');
 const cells=Array.from({length:n.s},(_,k)=>p.h?i+k:i+8*k);if(cells.some(x=>p.ships.flat().includes(x)))return alert('Overlaps something');p.ships.push(cells);game(id)}
