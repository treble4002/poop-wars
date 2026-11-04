// Poop Wars server. Run: node server.js
// Env: PORT, DATABASE_URL (Postgres; else in-memory pg-mem for dev/tests), SUPABASE_URL + SUPABASE_ANON_KEY (email-code login; else dev name login), ADMIN_TOKEN (enables POST /api/admin/invites).
const db=require('./src/db'),S=require('./src/store'),{create}=require('./src/http');
const PORT=process.env.PORT||3737;
(async()=>{const mode=await db.init();await S.ensureBot();
 create().listen(PORT,()=>console.log(`🚽 Poop Wars on http://localhost:${PORT} (storage: ${mode}, auth: ${require('./src/auth').supabaseEnabled()?'supabase email codes':'dev name login'})`))})()
 .catch(e=>{console.error(e);process.exit(1)});
