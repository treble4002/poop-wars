// Stall Wars screen. Registers R.dots(game, statusText, opponentName) -> HTML.
R.dots=(g,s)=>{const sc=[0,1].map(p=>g.boxes.filter(b=>b===p).length);let cells='';
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){if(r%2==0&&c%2==0)cells+='<div class=d></div>';
   else if(r%2==0){const i=(r/2)*4+(c-1)/2;cells+=`<div class="h ${g.lines[i]!=null?'p'+g.lines[i]:''}" onclick="mv('${g.id}',{pos:${i}})"></div>`}
   else if(c%2==0){const i=20+((r-1)/2)*5+c/2;cells+=`<div class="v ${g.lines[i]!=null?'p'+g.lines[i]:''}" onclick="mv('${g.id}',{pos:${i}})"></div>`}
   else{const k=((r-1)/2)*4+(c-1)/2;cells+=`<div class=b>${g.boxes[k]==null?'':MK[g.boxes[k]]}</div>`}}
  return`<div class="card big">${s}<br>Stalls: You ${sc[g.me]} · Them ${sc[1-g.me]}</div><div class="card dots">${cells}</div><small>Tap the space between two dots to build a wall. Your walls are ${g.me?'gold':'brown'}.</small>`};
