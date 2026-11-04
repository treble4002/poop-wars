// Database layer. Postgres when DATABASE_URL is set, else in-memory pg-mem (dev/tests, resets on restart).
const fs=require('fs'),path=require('path');
let pool=null,mode='';
async function init(){
  if(process.env.DATABASE_URL){const{Pool}=require('pg');const u=process.env.DATABASE_URL;
    pool=new Pool({connectionString:u,ssl:/localhost|127\.0\.0\.1/.test(u)?false:{rejectUnauthorized:false}});mode='postgres'}
  else{const{newDb}=require('pg-mem');const mem=newDb();const{Pool}=mem.adapters.createPg();pool=new Pool();mode='pg-mem'}
  const sql=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8').replace(/--.*$/gm,'');
  for(const st of sql.split(';').map(s=>s.trim()).filter(Boolean))await pool.query(st);
  return mode}
const q=(text,params)=>pool.query(text,params);
const one=async(text,params)=>(await pool.query(text,params)).rows[0]||null;
const all=async(text,params)=>(await pool.query(text,params)).rows;
// Run fn(client) inside BEGIN/COMMIT; rolls back on throw.
async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r}
  catch(e){try{await c.query('ROLLBACK')}catch(_){}throw e}finally{c.release()}}
const end=()=>pool&&pool.end&&pool.end();
module.exports={init,q,one,all,tx,end,get mode(){return mode}};
