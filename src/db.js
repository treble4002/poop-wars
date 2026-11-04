// Database layer. Postgres when DATABASE_URL is set, else in-memory pg-mem (dev/tests, resets on restart).
const fs=require('fs'),path=require('path');
let pool=null,mode='';
async function init(){
  if(process.env.DATABASE_URL){const{Pool}=require('pg');const u=process.env.DATABASE_URL;
    pool=new Pool({connectionString:u,max:Number(process.env.PG_POOL_MAX)||5,connectionTimeoutMillis:15000,idleTimeoutMillis:30000,keepAlive:true,ssl:/localhost|127\.0\.0\.1/.test(u)?false:{rejectUnauthorized:false}});pool.on('error',e=>console.error('pg idle client error (ignored):',e.message));mode='postgres'}
  else{const{newDb}=require('pg-mem');const mem=newDb();const{Pool}=mem.adapters.createPg();pool=new Pool();mode='pg-mem'}
  const sql=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8').replace(/--.*$/gm,'');
  for(const st of sql.split(';').map(s=>s.trim()).filter(Boolean))await pool.query(st);
  // On real Postgres (e.g. Supabase) turn on row-level security with no policies, so the public REST API
  // (anon/publishable key) can't read or write game tables. The server connects as the owner and bypasses RLS.
  if(mode==='postgres')for(const t of['users','circles','circle_members','games','moves','invite_codes','pending_signups','taunts','blocks','reports','match_queue'])
    await pool.query(`alter table ${t} enable row level security`);
  return mode}
const q=(text,params)=>pool.query(text,params);
const one=async(text,params)=>(await pool.query(text,params)).rows[0]||null;
const all=async(text,params)=>(await pool.query(text,params)).rows;
// Run fn(client) inside BEGIN/COMMIT; rolls back on throw.
async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r}
  catch(e){try{await c.query('ROLLBACK')}catch(_){}throw e}finally{c.release()}}
const end=()=>pool&&pool.end&&pool.end();
module.exports={init,q,one,all,tx,end,get mode(){return mode}};
