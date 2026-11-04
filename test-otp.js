// OTP code format test (in-process, pg-mem, Supabase calls stubbed). Run: node test-otp.js
delete process.env.DATABASE_URL;process.env.SUPABASE_URL='https://stub.supabase.co';process.env.SUPABASE_ANON_KEY='stub';
const db=require('./src/db'),A=require('./src/auth'),{create}=require('./src/http');const seen=[];
A.verifyCode=async(email,code)=>{seen.push(code);return{authId:'auth-'+code,email}};
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{await db.init();const srv=create().listen(0);const B=`http://localhost:${srv.address().port}/api/`;
 const v=async code=>{const r=await fetch(B+'auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'a@b.co',code})});return r.status};
 for(const c of['123456','1234567','12345678',' 1234 5678 '])ok(await v(c)===200,`Code "${c}" accepted`);
 for(const c of['12345','123456789','12ab56','',null])ok(await v(c)===400,`Code ${JSON.stringify(c)} rejected`);
 ok(seen.includes('12345678')&&!seen.includes('12345'),'Only valid codes reach Supabase');
 const js=await (await fetch(B.replace('/api/','/js/app.js'))).text();ok(/maxlength=8 pattern="\[0-9\]\{6,8\}"/.test(js)&&/d\.length===8/.test(js),'Frontend accepts 6-8 digits + auto-submits');
 srv.close();console.log(f?f+' FAILED':'OTP ALL PASSED');process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(1)});
