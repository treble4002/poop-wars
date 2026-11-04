// Game registry + shared engine (apply move, bot turns, per-player view).
const{BOT}=require('../util');
const GAMES={ttt:require('./ttt'),c4:require('./c4'),follow:require('./follow'),dots:require('./dots'),sink:require('./sink'),hang:require('./hang')};
const TYPES=Object.keys(GAMES);
function applyMove(g,me,b){if(g.status!=='active')return'Game over';const m=GAMES[g.type];return m?m.move(g,me,b):'Unknown game'}
function botAct(g){const bi=g.players.indexOf(BOT);if(bi<0)return;const m=GAMES[g.type],hard=g.diff==='hard';
 for(let n=0;n<300&&g.status==='active';n++){const mv=m.bot(g,bi,hard);if(!mv)return;const e=applyMove(g,bi,mv);if(e){console.error('bot error',e);return}}}
function newGame(base,b,vsBot){const g={...base,turn:0,status:'active',winner:null};GAMES[g.type].init(g,b,vsBot);return g}
function view(g,uid,names){const me=g.players.indexOf(uid),m=GAMES[g.type],done=g.status==='done';
 const o={id:g.id,type:g.type,circleId:g.circleId,players:g.players,names,turn:g.turn,status:g.status,winner:g.winner,updated:g.updated,diff:g.diff,me,
  myTurn:m.myTurn(g,me),last:g.last,vsBot:g.players.includes(BOT),random:!!g.random};m.view(g,o,me,uid,done);return o}
module.exports={GAMES,TYPES,applyMove,botAct,newGame,view};
