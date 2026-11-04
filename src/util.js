const crypto=require('crypto');
const id=(n=8)=>crypto.randomBytes(n).toString('hex');
const ALPH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code=(n=6)=>Array.from({length:n},()=>ALPH[crypto.randomInt(ALPH.length)]).join('');
const rnd=a=>a[Math.random()*a.length|0];
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const BOT='bot';
module.exports={id,code,rnd,hash,BOT};
