// ponytail: hits live nginx; add route when controller added. ceiling: live http, upgrade to supertest+AppModule when need offline.
const BASE = process.env.BASE_URL || 'http://localhost:80';
const isRoute404 = (s: number, b: any) => s===404 && typeof b?.message==='string' && b.message.startsWith('Cannot ');
async function login(email:string,password:string){ const r=await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})}); const j=await r.json(); if(r.status!==200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(j)}`); return j.access_token as string; }
async function hit(method:string, path:string, opts:{token?:string, body?:any}={}){ const h:any={}; if(opts.token) h['authorization']=`Bearer ${opts.token}`; if(opts.body) h['content-type']='application/json'; const r=await fetch(`${BASE}${path}`,{method,headers:h,body: opts.body?JSON.stringify(opts.body):undefined}); const t=await r.text(); let j:any; try{ j=JSON.parse(t)}catch{ j={_raw:t.slice(0,400)}}; return {status:r.status, body:j, route404:isRoute404(r.status,j)}; }

describe('endpoints live (nginx->backend prefix)', ()=>{
  let admin='', manager='', user='';
  beforeAll(async()=>{ admin=await login('admin@roomflow.local','password123'); manager=await login('manager@roomflow.local','password123'); user=await login('user@roomflow.local','password123'); }, 15000);

  test('auth login works', async()=>{ const r=await hit('POST','/api/auth/login',{body:{email:'admin@roomflow.local',password:'password123'}}); expect(r.status).toBe(200); expect(r.route404).toBe(false); });
  test('auth/me authorized', async()=>{ const r=await hit('GET','/api/auth/me',{token:admin}); expect(r.route404).toBe(false); expect(r.status).toBe(200); });
  test('auth/me unauthenticated is 401 not route 404', async()=>{ const r=await hit('GET','/api/auth/me'); expect(r.route404).toBe(false); expect(r.status).toBe(401); });
  test('health and root', async()=>{ for(const p of ['/api','/api/health']){ const r=await hit('GET',p); expect(r.route404).toBe(false); expect(r.status).toBe(200);} });
  test('public rooms/buildings', async()=>{ for(const p of ['/api/rooms/rentable','/api/payment-gateways/available','/api/payments/gateways']){ const r=await hit('GET',p); expect(r.route404).toBe(false); expect(r.status).not.toBe(404); } const r=await hit('GET','/api/buildings',{token:admin}); expect(r.route404).toBe(false); expect(r.status).toBe(200); });
  test('rooms crud routes exist', async()=>{ const r1=await hit('GET','/api/rooms',{token:admin}); expect(r1.route404).toBe(false); const r2=await hit('GET','/api/rooms/00000000-0000-0000-0000-000000000000',{token:admin}); expect(r2.route404).toBe(false); // domain 404 vs route 404 — both not route404
  });
  test('rentals, payments, bookings', async()=>{ for(const [m,p,t] of [['GET','/api/rentals/available-rooms',user],['GET','/api/rentals/slots',user],['GET','/api/payments/my',user],['GET','/api/bookings',admin],['GET','/api/booking-change-requests',admin]] as const){ const r=await hit(m,p,{token:t}); expect(r.route404).toBe(false); expect(r.status).not.toBe(404); } });
  test('admin, chat, storage, notifications', async()=>{ for(const [m,p] of [['GET','/api/users/managers'],['GET','/api/notifications'],['GET','/api/chat/conversations'],['GET','/api/storage/config'],['GET','/api/waha-config'],['GET','/api/email-config'],['GET','/api/rentals/holds/active']] as const){ const t = p==='/api/rentals/holds/active' ? user : admin; const r=await hit(m,p,{token:t}); expect(r.route404).toBe(false); } });
  test('pakasir webhook public', async()=>{ const r=await hit('POST','/api/pakasir/webhook',{body:{foo:1}}); expect(r.route404).toBe(false); expect(r.status).toBe(200); });
  test('backend direct parity', async()=>{ const r=await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@roomflow.local',password:'password123'})}); expect(r.status).toBe(200); });
});
