// Tiny HTTP layer: static files from public/, JSON API dispatch, auth + premium checks.
const http=require('http'),fs=require('fs'),path=require('path'),S=require('./store'),{routes,isPremium}=require('./routes');
const PUBLIC=path.join(__dirname,'..','public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const send=(res,s,o)=>{res.writeHead(s,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
// Pages: / is the welcome page, /play (and anything under /play/) is the game app. Old /index.html links go to /play.
function page(p){if(p==='/'||p==='/welcome')return'landing.html';if(p==='/rules'||p==='/privacy')return'rules.html';if(p==='/play'||p==='/play/'||p.startsWith('/play/')&&!path.extname(p))return'play.html';return null}
function serveStatic(u,res){if(u.pathname==='/index.html'){res.writeHead(301,{Location:'/play'+u.search});return res.end()}
 let rel;try{rel=page(u.pathname)||path.normalize(decodeURIComponent(u.pathname))}catch(e){return send(res,400,{})}const f=path.join(PUBLIC,rel);
 if(!f.startsWith(PUBLIC))return send(res,403,{});
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nope')}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'text/plain','X-Content-Type-Options':'nosniff',...(f.endsWith('.html')?{'Cache-Control':'no-cache'}:{})});res.end(d)})}
function create(){return http.createServer((req,res)=>{const u=new URL(req.url,'http://x');
 if(!u.pathname.startsWith('/api/'))return serveStatic(u,res);
 let body='';req.on('data',c=>{body+=c;if(body.length>1e5)req.destroy()});req.on('end',async()=>{
  const r=routes[req.method+' '+u.pathname];if(!r)return send(res,404,{error:'No route'});const[flags,fn]=r;
  let b={};try{b=body?JSON.parse(body):{}}catch(e){return send(res,400,{error:'Bad JSON'})}
  try{const user=await S.userByToken(req.headers['x-token']);
   if(!flags.public&&!user)return send(res,401,{error:'Sign up first'});
   if(flags.premium&&!isPremium(user))return send(res,402,{error:'Premium feature 👑',premiumRequired:true});
   const[s,o]=await fn({b,u:user,q:Object.fromEntries(u.searchParams),req});send(res,s,o)}
  catch(e){if(e.status)return send(res,e.status,{error:e.message});console.error(e);send(res,500,{error:'Server clogged'})}})})}
module.exports={create};
