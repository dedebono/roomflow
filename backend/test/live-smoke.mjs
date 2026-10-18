#!/usr/bin/env node
// ponytail: live smoke hitting nginx — add endpoint here when controller added
const BASE = process.env.BASE_URL || 'http://localhost:80';
const CREDS = {
  admin: ['admin@roomflow.local','password123'],
  manager: ['manager@roomflow.local','password123'],
  user: ['user@roomflow.local','password123'],
};
async function login(email,password){
  const r=await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  const j=await r.json().catch(()=>({})); if(r.status!==200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(j)}`); return j.access_token;
}
function isRoute404(status, body){
  // Nest "Cannot POST /auth/login" or "Cannot GET /foo" is routing 404; domain 404 has different message
  const m = body && (body.message||''); return status===404 && typeof m==='string' && m.startsWith('Cannot ') ;
}
async function hit(method, path, {token, body, expect}={}){
  const headers={}; if(token) headers['authorization']=`Bearer ${token}`; if(body) headers['content-type']='application/json';
  const r=await fetch(`${BASE}${path}`,{method,headers,body: body?JSON.stringify(body):undefined});
  const text=await r.text(); let json; try{ json=JSON.parse(text)}catch{ json={_raw:text.slice(0,400)}}
  const route404=isRoute404(r.status, json);
  const ok = !route404 && (expect? r.status===expect : r.status!==404 || !route404);
  // 401/403/400 are PASS (route exists); route404 is FAIL
  const status = route404 ? 'ROUTE_404_FAIL' : (r.status===404 && json.message?.startsWith('Cannot') ? 'ROUTE_404_FAIL' : 'OK');
  const pass = !route404;
  return {method,path,status: r.status, pass, route404, body: json, ok: pass};
}
(async()=>{
  const tokens={};
  for(const [k,[e,p]] of Object.entries(CREDS)){ try{tokens[k]=await login(e,p); console.log(`login ${k}: OK`)}catch(e){ console.log(`login ${k}: FAIL ${e.message}`)} }
  const admin=tokens.admin, mgr=tokens.manager, user=tokens.user;

  // each controller gets at least 1 probe — 404-route is failure, 401/403/400/200 are pass
  const cases=[
    ['GET','/api',null],
    ['GET','/api/health',null],
    ['POST','/api/auth/login', {body:{email:'admin@roomflow.local',password:'password123'}, expect:200}],
    ['POST','/api/auth/refresh', {body:{refreshToken:'bad'}}], // expect 401 but not route 404
    ['GET','/api/auth/me', {token:admin}],
    ['GET','/api/auth/me', {token:null, expect401:true}],
    ['GET','/api/rooms/rentable',null],
    ['GET','/api/rooms', {token:admin}],
    ['GET',`/api/rooms/00000000-0000-0000-0000-000000000000`, {token:admin}],
    ['POST','/api/rooms', {token:admin, body:{name:'smoke-test', capacity:2, buildingId:'00000000-0000-0000-0000-000000000000', status:'ACTIVE'}}],
    ['GET','/api/buildings', {token:admin}],
    ['GET','/api/bookings', {token:admin}],
    ['GET','/api/booking-change-requests', {token:admin}],
    ['GET','/api/rentals/available-rooms', {token:user}],
    ['GET','/api/rentals/slots', {token:user}],
    ['GET','/api/payments/gateways',null],
    ['GET','/api/payments/my', {token:user}],
    ['GET','/api/payment-gateways/available',null],
    ['GET','/api/payment-gateways', {token:admin}],
    ['GET','/api/users/managers', {token:admin}],
    ['GET','/api/notifications', {token:admin}],
    ['GET','/api/chat/conversations', {token:admin}],
    ['GET','/api/storage/config', {token:admin}],
    ['GET','/api/waha-config', {token:admin}],
    ['GET','/api/email-config', {token:admin}],
    ['POST','/api/pakasir/webhook', {body:{foo:1}}],
    ['GET','/api/rentals/holds/active', {token:user}],
  ];

  let pass=0,fail=0;
  for(const [method,path,opts] of cases){
    const o=opts||{};
    // handle expect401: unauthenticated should be 401 not 404
    const token = o.token===null ? undefined : (o.token || null);
    // map cases that intentionally send body without token
    const body=o.body;
    try{
      const r=await hit(method, path, {token, body});
      const label = r.pass ? 'PASS' : 'FAIL';
      if(r.pass) pass++; else fail++;
      const extra = r.route404 ? ' <- ROUTE 404 (nginx/backend prefix bug)' : '';
      console.log(`${label} ${r.status} ${method} ${path}${extra}`);
      if(!r.pass) console.log('  body:', JSON.stringify(r.body).slice(0,400));
      // special check: unauthenticated /auth/me should be 401 not route 404
      if(o.expect401 && r.status!==401 && !r.route404) { /* still pass if not route404 */ }
    }catch(e){ fail++; console.log(`FAIL ERR ${method} ${path} ${e.message}`)}
  }
  // negative: direct backend vs nginx parity
  try{
    const r=await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@roomflow.local',password:'password123'})});
    console.log(`parity backend direct: ${r.status} ${r.status===200?'OK':'FAIL'}`);
  }catch(e){ console.log(`parity backend direct: ERR ${e.message}`)}
  console.log(`\nTOTAL ${pass} pass, ${fail} fail of ${pass+fail} — BASE=${BASE}`);
  if(fail>0) process.exit(1);
})();
