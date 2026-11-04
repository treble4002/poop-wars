// Follow the Flush (4-pad memory race; same server-made pattern for both players)
const crypto=require('crypto'),{BOT}=require('../util'),{finish}=require('./common');
const SEQMAX=40,better=(a,b)=>a.len!==b.len?a.len>b.len:a.ms<b.ms;
function botRun(hard){const len=hard?11+(Math.random()*4|0):4+(Math.random()*3|0);let ms=0;
 for(let r=1;r<=len;r++)for(let k=0;k<r;k++)ms+=hard?280+Math.random()*180:420+Math.random()*260;return{len,ms:Math.round(ms)}}
module.exports={SEQMAX,better,
 init(g){g.seq=Array.from({length:SEQMAX},()=>crypto.randomInt(4));g.res={};g.started={}},
 move(g,me,b){const pid=g.players[me];if(g.res[pid])return'Already played';
  if(b.start){if(pid!==BOT&&!g.started[pid])g.started[pid]=Date.now();return null}
  const len=Number(b.len),ms=Math.round(Number(b.ms));if(!(Number.isInteger(len)&&len>=0&&len<=SEQMAX))return'Bad length';
  if(pid!==BOT){if(!g.started[pid])return'Start first';if(len>0&&(!(ms>=len*(len+1)/2*80)||ms>Date.now()-g.started[pid]+2000))return'Suspicious time 🤨'}
  g.res[pid]={len,ms:len?ms:0};
  if(Object.keys(g.res).length===2){const[a,c]=g.players.map(p=>g.res[p]);finish(g,a.len===c.len&&a.ms===c.ms?'draw':better(a,c)?g.players[0]:g.players[1])}return null},
 bot(g,bi,hard){return g.res[BOT]?null:botRun(hard)},
 myTurn(g,me){return g.status==='active'&&!g.res[g.players[me]]},
 view(g,o,me,uid,done){o.res=done?g.res:{[uid]:g.res[uid]};o.started=!!g.started[uid];if(g.started[uid]||done)o.seq=g.seq;o.seqMax=SEQMAX}};
