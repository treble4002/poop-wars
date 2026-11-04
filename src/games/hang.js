// Hang-Ten TP (hangman, challenger may set the word; fewest misses wins)
const{rnd}=require('../util'),{finish}=require('./common');
const WORDS='PLUNGER BUBBLES TOWEL FAUCET SHOWER BATHTUB SOAP TOOTHBRUSH SPONGE MIRROR SLIPPERS PICKLE PENGUIN PIZZA NOODLE BANANA WAFFLE PUDDLE GIGGLE WOBBLE KAZOO JELLYBEAN MARSHMALLOW TORNADO VOLCANO NAPKIN HICCUP SNORKEL BURRITO CUPCAKE GOBLIN ZOMBIE JIGSAW KETCHUP DRAGON POPCORN TOILET FLUSH PORCELAIN LOOFAH SQUEEGEE RUBBER DUCKY BLANKET PAJAMAS TACO HAMSTER WALRUS'.split(' ');
const MAXMISS=7,FREQ='EARIOTNSLCUDPMHGBFYWKVXZJQ';
function state(g,i){const w=g.words[i],gs=g.guesses[i],miss=gs.filter(l=>!w.includes(l)).length,solved=[...w].every(l=>gs.includes(l));return{miss,solved,over:solved||miss>=MAXMISS}}
const score=s=>s.solved?s.miss:MAXMISS+1;
function pick(g,me,hard){const gs=g.guesses[me],w=g.words[me];
 if(!hard){const opts=FREQ.split('').filter(l=>!gs.includes(l));return Math.random()<.5?opts[0]:rnd(opts.slice(0,12))}
 const wrong=gs.filter(l=>!w.includes(l)),pat=[...w].map(l=>gs.includes(l)?l:null);
 const cands=WORDS.filter(x=>x.length===w.length&&[...x].every((l,i)=>pat[i]?l===pat[i]:!gs.includes(l))&&!wrong.some(l=>x.includes(l)));
 const cnt={};for(const x of cands)for(const l of new Set(x))if(!gs.includes(l))cnt[l]=(cnt[l]||0)+1;
 const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];return best?best[0]:FREQ.split('').find(l=>!gs.includes(l))}
module.exports={
 validateOpts(b){if(!b.word)return null;const w=String(b.word).toUpperCase().trim();return/^[A-Z]{3,12}$/.test(w)?null:'Secret word must be 3-12 letters, no spaces'},
 init(g,b,vsBot){const w=b.word&&!vsBot?String(b.word).toUpperCase().trim():null;g.words=[rnd(WORDS),w||rnd(WORDS)];g.guesses=[[],[]]},
 move(g,me,b){const l=String(b.letter||'').toUpperCase();if(!/^[A-Z]$/.test(l))return'Pick a letter';if(state(g,me).over)return'Your round is over';
  if(g.guesses[me].includes(l))return'Already guessed';g.guesses[me].push(l);const s=[0,1].map(i=>state(g,i));
  if(s[0].over&&s[1].over){const a=score(s[0]),c=score(s[1]);finish(g,a===c?'draw':a<c?g.players[0]:g.players[1])}return null},
 bot(g,bi,hard){return state(g,bi).over?null:{letter:pick(g,bi,hard)}},
 myTurn(g,me){return g.status==='active'&&!state(g,me).over},
 view(g,o,me,uid,done){const s=state(g,me),w=g.words[me],gs=g.guesses[me];o.mask=[...w].map(l=>gs.includes(l)||s.over?l:'_');o.myGuesses=gs;o.myMiss=s.miss;o.myOver=s.over;o.solved=s.solved;
  const th=state(g,1-me);o.theirOver=th.over;o.maxMiss=MAXMISS;if(done){o.theirWord=g.words[1-me];o.theirMiss=th.miss;o.theirSolved=th.solved}}};
