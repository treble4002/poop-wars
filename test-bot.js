// Plunger Pete in Stall Wars: after the bot claims a stall it must keep its extra turn and
// always hand the turn back (or finish). Pure engine test. Run: node test-bot.js
const E=require('./src/games'),{BOT}=require('./src/util');let f=0,games=0,botExtra=0,humanExtra=0;
const ok=(c,m)=>{if(!c){console.log('FAIL '+m);f++}};
for(const diff of['easy','hard'])for(let n=0;n<300;n++){const g=E.newGame({id:'t'+n,type:'dots',players:['me',BOT],diff,created:0},{},true);
 let guard=0;while(g.status==='active'&&guard++<100){ok(g.turn===0,`${diff}#${n}: turn handed back to human`);if(g.turn!==0)break;
  const free=[...g.lines.keys()].filter(i=>g.lines[i]==null);const before=g.boxes.filter(x=>x===1).length,lb=g.lines.filter(x=>x===1).length;
  const e=E.applyMove(g,0,{pos:free[Math.random()*free.length|0]});ok(!e,'human move legal: '+e);if(g.turn===0&&g.status==='active'){humanExtra++;continue}
  E.botAct(g);const bl=g.lines.filter(x=>x===1).length-lb,bb=g.boxes.filter(x=>x===1).length-before;if(bb>0&&bl>1)botExtra++;
  ok(g.status==='done'||g.turn===0,`${diff}#${n}: bot finished its extra turns`)}
 ok(g.status==='done',`${diff}#${n}: game completes`);games++}
console.log(`dots vs bot: ${games} games, ${botExtra} bot extra-turn chains, ${humanExtra} human extra turns`);
console.log(f?f+' FAILED':'BOT ALL PASSED');process.exit(f?1:0);
