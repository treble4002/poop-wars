// Auth: Supabase email one-time codes when SUPABASE_URL + SUPABASE_ANON_KEY are set; otherwise dev name-only login.
const URL_=()=>(process.env.SUPABASE_URL||'').replace(/\/$/,''),KEY=()=>process.env.SUPABASE_ANON_KEY||'';
const supabaseEnabled=()=>!!(URL_()&&KEY());
async function sb(p,body){const r=await fetch(URL_()+'/auth/v1/'+p,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY(),Authorization:'Bearer '+KEY()},body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));if(!r.ok){const e=Error(j.msg||j.error_description||j.message||'Auth failed');e.status=r.status===429?429:400;throw e}return j}
// Sends a 6-digit code to the email (Supabase "Email OTP"; set the email template to include {{ .Token }}).
const sendCode=email=>sb('otp',{email,create_user:true});
// Returns {authId,email} when the code is right.
async function verifyCode(email,token){const j=await sb('verify',{type:'email',email,token});const u=j.user||{};if(!u.id)throw Object.assign(Error('Bad code'),{status:400});return{authId:u.id,email:u.email||email}}
// Age gate. Returns {age} or {error}. Pure function of birthdate and today (UTC).
function ageFrom(bd,now=new Date()){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(bd||''));if(!m)return{error:'Birthdate required (YYYY-MM-DD)'};
 const[y,mo,d]=m.slice(1).map(Number),dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d||dt>now)return{error:'Birthdate is not valid'};
 let age=now.getUTCFullYear()-y;if(now.getUTCMonth()+1<mo||(now.getUTCMonth()+1===mo&&now.getUTCDate()<d))age--;if(age>120)return{error:'Birthdate is not valid'};return{age}}
const validEmail=e=>/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(String(e||''))&&String(e).length<=200;
module.exports={supabaseEnabled,sendCode,verifyCode,ageFrom,validEmail};
