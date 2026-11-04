// Poop Wars server. Run: node server.js
// Env: PORT, DATABASE_URL (Postgres; else in-memory pg-mem for dev/tests), SUPABASE_URL + SUPABASE_ANON_KEY (email-code login; else dev name login), ADMIN_TOKEN (enables POST /api/admin/invites).
const db=require('./src/db'),S=require('./src/store'),{create}=require('./src/http');
const PORT=process.env.PORT||3737;
(async()=>{const mode=await db.init();await S.ensureBot();
 {const sw=()=>S.sweepTaunts().catch(e=>console.error('taunt sweep',e.message));sw();setInterval(sw,15*60*1000).unref()}
 const srv=create();
 // Keep idle connections open longer than Render's proxy does (Node's default 5s causes sporadic dropped requests on reused connections).
 srv.keepAliveTimeout=65000;srv.headersTimeout=66000;
 srv.listen(PORT,()=>console.log(`🚽 Poop Wars on http://localhost:${PORT} (storage: ${mode}, auth: ${require('./src/auth').supabaseEnabled()?'supabase email codes':'dev name login'})`));
 // Graceful shutdown on deploys: stop taking new connections, let in-flight requests finish, then close the DB pool.
 let closing=false;const stop=sig=>{if(closing)return;closing=true;console.log(`${sig}: draining`);srv.close(()=>{Promise.resolve(db.end&&db.end()).catch(()=>{});console.log('closed');process.exit(0)});
  srv.closeIdleConnections&&srv.closeIdleConnections();setTimeout(()=>process.exit(0),25000).unref()};
 process.on('SIGTERM',()=>stop('SIGTERM'));process.on('SIGINT',()=>stop('SIGINT'))})()
 .catch(e=>{console.error(e);process.exit(1)});
