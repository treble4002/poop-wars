// Shared helpers for game modules.
const finish=(g,w)=>{g.status='done';g.winner=w};
const turnBot=(fn)=>(g,bi,hard)=>g.turn!==bi?null:{pos:fn(g,bi,hard)};
const myTurnDefault=(g,me)=>g.status==='active'&&g.turn===me;
module.exports={finish,turnBot,myTurnDefault};
