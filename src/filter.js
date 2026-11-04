// Basic server-side chat filter. Slurs/hate/sexual/self-harm => reject. Common swears => masked.
const norm=s=>s.toLowerCase().replace(/[0@]/g,'o').replace(/[1!|]/g,'i').replace(/3/g,'e').replace(/[4]/g,'a').replace(/[5$]/g,'s').replace(/7/g,'t').replace(/[^a-z]/g,'');
const REJECT=['nigg','nigga','fag','faggot','retard','tranny','chink','spic','kike','wetback','gook','dyke','coon','rape','rapist','kys','killyourself','killurself','porn','penis','vagina','dick','cock','pussy','cunt','whore','slut','nazi','hitler'];
const MASK=['fuck','shit','bitch','bastard','asshole','damn','crap','piss','bollocks','wanker','prick','douche','jackass','dumbass'];
function check(text){const n=norm(text);if(REJECT.some(w=>n.includes(w)))return{ok:false};
 let out=text;for(const w of MASK){const re=new RegExp(w.split('').map(c=>`[${c}${{a:'@4',e:'3',i:'1!|',o:'0',s:'5$',t:'7'}[c]||''}][^a-z0-9]*`).join(''),'gi');out=out.replace(re,m=>m[0]+'*'.repeat(m.length-1))}
 return{ok:true,text:out}}
module.exports={check};
