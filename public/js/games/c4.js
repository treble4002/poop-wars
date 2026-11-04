// Connect Four-Flush screen. Registers R.c4(game, statusText, opponentName) -> HTML.
R.c4=(g,s)=>`<div class="card big">${s}</div><div class="card c4">${g.board.map((v,i)=>`<div onclick="mv('${g.id}',{pos:${i%7}})">${v==null?'':MK[v]}</div>`).join('')}</div><small>Tap any spot in a column to drop your piece.</small>`;
