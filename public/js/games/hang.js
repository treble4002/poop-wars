// Hang-Ten TP screen. Registers R.hang(game, statusText, opponentName) -> HTML.
R.hang=(g,s,opp)=>{const left=g.maxMiss-g.myMiss;let h=`<div class="card big">${s}</div><div class="card big"><div style="font-size:30px">🧻${'▮'.repeat(left)}<span style="opacity:.25">${'▯'.repeat(g.myMiss)}</span></div><small>${left} sheets of TP left</small><div class=word>${g.mask.join(' ')}</div>`;
  if(!g.myOver)h+=`</div><div class="card kb">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l=>`<button ${g.myGuesses.includes(l)?'disabled':''} onclick="mv('${g.id}',{letter:'${l}'})">${l}</button>`).join('')}</div>`;
  else h+=`<br>${g.solved?`Solved with ${g.myMiss} miss${g.myMiss==1?'':'es'}!`:'Out of TP! 😱'}</div>`;
  if(g.myOver&&g.status==='active')h+=`<div class="card big">Waiting for ${opp} to finish their word…</div>`;
  if(g.status==='done')h+=`<div class="card big">${opp}'s word: <b>${g.theirWord}</b> · ${g.theirSolved?g.theirMiss+' misses':'not solved'}</div>`;return h};
