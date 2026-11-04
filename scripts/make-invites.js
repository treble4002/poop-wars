#!/usr/bin/env node
// Generate single-use invite codes. Usage:
//   DATABASE_URL=postgres://... node scripts/make-invites.js 20 [pilot|premium] ["note, e.g. Lauren's friends"]
// 'pilot' codes give lifetime full premium (pilot flag). 'premium' codes give the premium flag only.
// Without DATABASE_URL there is no shared database to write to (pg-mem is per-process); use
// POST /api/admin/invites with the x-admin-token header against a running dev server instead.
const db=require('../src/db'),S=require('../src/store');
(async()=>{if(!process.env.DATABASE_URL){console.error('Set DATABASE_URL (see comment at top of this file).');process.exit(1)}
 const n=Math.max(1,Number(process.argv[2])||1),kind=process.argv[3]==='premium'?'premium':'pilot';
 await db.init();const codes=await S.createInvites(n,kind,process.argv[4]||null);console.log(codes.join('\n'));await db.end()})()
 .catch(e=>{console.error(e);process.exit(1)});
