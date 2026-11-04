// Auth: Supabase email one-time codes when SUPABASE_URL + SUPABASE_ANON_KEY are set; otherwise dev name-only login.
// SUPABASE_URL may be pasted with a path (e.g. .../rest/v1/); keep only scheme://host.
function origin(u){u=String(u||'').trim();if(!u)return'';try{return new URL(u).origin}catch{return''}}
const URL_=()=>origin(process.env.SUPABASE_URL),KEY=()=>(process.env.SUPABASE_ANON_KEY||'').trim();
// Legacy anon keys are JWTs (eyJ...) and go in both headers. New sb_publishable_ keys are not JWTs: send them as apikey only.
const hdrs=()=>{const k=KEY(),h={'Content-Type':'application/json',apikey:k};if(k.startsWith('eyJ'))h.Authorization='Bearer '+k;return h};
const supabaseEnabled=()=>!!(URL_()&&KEY());
async function sb(p,body){const r=await fetch(URL_()+'/auth/v1/'+p,{method:'POST',headers:hdrs(),body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));if(!r.ok){const e=Error(j.msg||j.error_description||j.message||'Auth failed');e.status=r.status===429?429:400;throw e}return j}
// Sends a 6-digit code to the email (Supabase "Email OTP"; set the email template to include {{ .Token }}).
const sendCode=email=>sb('otp',{email,create_user:true});
// Returns {authId,email} when the code is right.
async function verifyCode(email,token){const j=await sb('verify',{type:'email',email,token});const u=j.user||{};if(!u.id)throw Object.assign(Error('Bad code'),{status:400});return{authId:u.id,email:u.email||email}}
const validEmail=e=>/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(String(e||""))&&String(e).length<=200;
module.exports={origin,supabaseEnabled,sendCode,verifyCode,validEmail};
