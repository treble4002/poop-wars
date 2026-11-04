// Tic-Tac-Toilet screen. Registers R.ttt(game, statusText, opponentName) -> HTML.
R.ttt=(g,s)=>`<div class="card big">${s}</div><div class="card ttt">${g.board.map((v,i)=>`<div onclick="mv('${g.id}',{pos:${i}})">${v==null?'':MK[v]}</div>`).join('')}</div>`;
