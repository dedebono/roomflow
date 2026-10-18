#!/usr/bin/env node
// ponytail: user-path smoke — all endpoints from user token. expect: 200/201 for user routes, 403 for admin-only, never route 404.
const BASE = process.env.BASE_URL || 'http://localhost:80';
const isRoute404 = (s,b)=> s===404 && typeof b?.message==='string' && b.message.startsWith('Cannot ');
async function login(email,password){
  const r=await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  const j=await r.json().catch(()=>({})); if(r.status!==200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(j)}`); return j.access_token;
}
async function hit(method, path, opts={}){
  const h={}; if(opts.token) h['authorization']=`Bearer ${opts.token}`; if(opts.body!==undefined) h['content-type']='application/json';
  const r=await fetch(`${BASE}${path}`,{method,headers:h,body: opts.body!==undefined?JSON.stringify(opts.body):undefined});
  const t=await r.text(); let j; try{ j=JSON.parse(t)}catch{ j={_raw:t.slice(0,500)}}
  return {status:r.status, body:j, route404:isRoute404(r.status,j)};
}
(async()=>{
  const userToken = await login('user@roomflow.local','password123');
  const renterToken = await login('jack@mail.com','password123').catch(()=> null);
  console.log(`login user: OK  renter: ${renterToken?'OK':'SKIP (jack@mail.com not seeded yet)'}`);

  // fetch one room id for id-dependent probes
  let roomId=null, buildingId=null;
  try{ const r=await hit('GET','/api/rooms/rentable'); if(Array.isArray(r.body) && r.body[0]?.id) roomId=r.body[0].id; if(Array.isArray(r.body) && r.body[0]?.buildingId) buildingId=r.body[0].buildingId; }catch{}
  if(!roomId){ try{ const r=await hit('GET','/api/rentals/available-rooms',{token:userToken}); if(Array.isArray(r.body) && r.body[0]?.id) roomId=r.body[0].id; }catch{} }
  console.log(`probe roomId=${roomId || 'none'} buildingId=${buildingId||'none'}`);

  // [method, path, expectForUser: 'ok'|'forbidden'|'public', note]
  // ok = user should get 2xx or validation 400, forbidden = 403, public = 200 without token, never route404
  const cases = [
    // public — user also gets 200
    ['GET','/api', 'public'], ['GET','/api/health','public'],
    ['POST','/api/auth/login','public'], ['POST','/api/auth/refresh','public'], ['GET','/api/auth/me','ok'],
    ['GET','/api/rooms/rentable','public'], ['GET',`/api/rooms/${roomId||'00000000-0000-0000-0000-000000000000'}/slots`,'public'],
    ['GET','/api/payment-gateways/available','public'], ['GET','/api/payments/gateways','public'],
    ['GET','/api/rentals/available-rooms','ok'], ['GET',`/api/rentals/rooms/${roomId||'00000000-0000-0000-0000-000000000000'}/availability`,'public'], ['POST','/api/rentals/check-availability','public'], ['POST','/api/pakasir/webhook','public'], ['GET','/api/payments/confirm-callback','public'],
    ['GET','/api/rentals/slots','ok'], ['GET','/api/rentals/available-slots','ok'], ['GET','/api/rentals/active-hold','ok'],

    // authenticated user — should work
    ['GET','/api/buildings','ok'], ['GET','/api/rooms','ok'], ['GET',`/api/rooms/${roomId||'00000000-0000-0000-0000-000000000000'}`,'ok'],
    ['GET','/api/bookings','ok'], ['POST','/api/bookings','ok'],
    ['GET','/api/booking-change-requests','ok'], ['POST','/api/booking-change-requests','ok'],
    ['GET','/api/rentals/my-bookings','ok'], ['GET','/api/rentals/my-holds','ok'], ['GET','/api/rentals/holds/active','ok'], ['GET','/api/rentals/stats','ok'],
    ['POST','/api/rentals/create-hold','ok'], ['POST','/api/rentals/create-holds','ok'],
    ['GET','/api/payments/my','ok'], ['POST','/api/payments/initiate','ok'], ['POST','/api/payments/initiate-batch','ok'],
    ['GET','/api/notifications','ok'], ['GET','/api/notifications/unread-count','ok'], ['PATCH','/api/notifications/read-all','ok'],
    ['GET','/api/chat/conversations','ok'], ['POST','/api/chat/conversations','ok'], ['GET','/api/chat/unread-count','ok'],
    ['GET','/api/users/managers','ok'], // at least reachable (may be 403 for USER role — check guard)
    ['GET','/api/rentals/holds/00000000-0000-0000-0000-000000000000','ok'],

    // admin-only — user should get 403 (not route 404) — verify route exists
    ['POST','/api/rooms','forbidden'], ['PATCH',`/api/rooms/${roomId||'00000000-0000-0000-0000-000000000000'}`,'forbidden'],
    ['POST','/api/buildings','forbidden'], ['PATCH','/api/buildings/00000000-0000-0000-0000-000000000000','forbidden'],
    ['GET','/api/rentals/holds','forbidden'], ['POST','/api/rentals/slots','forbidden'],
    ['GET','/api/payments/pending','forbidden'], ['PATCH','/api/payments/00000000-0000-0000-0000-000000000000/approve','forbidden'],
    ['GET','/api/payment-gateways','forbidden'], ['POST','/api/payment-gateways','forbidden'],
    ['GET','/api/users','forbidden'], ['POST','/api/users','forbidden'],
    ['GET','/api/storage/config','forbidden'], ['POST','/api/storage/config','forbidden'],
    ['GET','/api/waha-config','forbidden'], ['GET','/api/email-config','forbidden'],
    ['PATCH','/api/booking-change-requests/00000000-0000-0000-0000-000000000000/approve','forbidden'],
  ];

  let pass=0, fail=0;
  const failures=[];
  for(const [method, path, expect] of cases){
    const token = expect==='public' ? undefined : userToken;
    // body for POST that need it — send minimal invalid to get 400 not 404
    let body;
    if(method==='POST' || method==='PATCH'){
      if(path==='/api/auth/login') body={email:'user@roomflow.local',password:'password123'};
      else if(path==='/api/auth/refresh') body={refreshToken:'bad'};
      else if(path==='/api/pakasir/webhook') body={foo:1};
      else if(path==='/api/rentals/check-availability') body={roomId: roomId||'00000000-0000-0000-0000-000000000000', date:'2026-10-17'};
      else if(path==='/api/rentals/create-hold') body={roomId: roomId||'00000000-0000-0000-0000-000000000000', date:'2026-10-17', slotIds:[]};
      else if(path==='/api/rentals/create-holds') body={holds:[]};
      else if(path==='/api/bookings') body={};
      else if(path==='/api/booking-change-requests') body={};
      else if(path==='/api/payments/initiate') body={};
      else if(path==='/api/payments/initiate-batch') body={bookingIds:[]};
      else if(path==='/api/chat/conversations') body={participantId:'00000000-0000-0000-0000-000000000000'};
      else if(path==='/api/rooms') body={name:'smoke', capacity:1, buildingId: buildingId||'00000000-0000-0000-0000-000000000000'};
      else if(path==='/api/buildings') body={name:'smoke-b'};
      else if(path==='/api/rentals/slots') body={roomId: roomId||'00000000-0000-0000-0000-000000000000', dayOfWeek:1, startTime:'09:00', endTime:'10:00'};
      else if(path==='/api/payment-gateways') body={name:'smoke', config:{}};
      else if(path==='/api/users') body={email:'smoke@example.com', password:'password123', name:'smoke'};
      else if(path==='/api/storage/config') body={provider:'local'};
      else body={};
    }
    // path that already has body above for login/refresh handled; override for auth cases
    if(path==='/api/auth/login' && expect==='public') { body={email:'user@roomflow.local',password:'password123'}; }
    const r=await hit(method, path, {token, body});
    const route404=r.route404;
    let ok=false, reason='';
    if(route404){ ok=false; reason='ROUTE 404 (nginx/backend prefix)'; }
    else if(expect==='forbidden'){ ok = r.status===403; reason = ok?'403 as expected':`expected 403 got ${r.status}`; }
    else if(expect==='public'){ ok = r.status===200 || r.status===201; reason = ok?`${r.status}`:`expected 200 got ${r.status}`; }
    else { // ok — any non-route404 that is not 403-for-admin leak is pass; 200/201/400/422 are all "route reachable"
      // for ok we accept 200/201/400/422/404-domain (not route404); 403 on ok is fail (user should be allowed)
      if(r.status===403){ ok=false; reason='unexpected 403 — user should have access'; }
      else if(r.route404){ ok=false; reason='route 404'; }
      else ok=true, reason=`${r.status}`;
    }
    if(ok){ pass++; console.log(`PASS ${r.status} ${method} ${path} [${expect}] ${reason}`); }
    else { fail++; console.log(`FAIL ${r.status} ${method} ${path} [${expect}] ${reason} body:${JSON.stringify(r.body).slice(0,250)}`); failures.push({method,path,expect,status:r.status,body:r.body}); }
  }
  console.log(`\nTOTAL ${pass} pass, ${fail} fail of ${pass+fail} — BASE=${BASE} roomId=${roomId}`);
  if(fail>0){
    // summary of unexpected
    console.log('failures:', failures.map(f=>`${f.method} ${f.path} expect=${f.expect} got=${f.status}`).join(' | '));
    process.exit(1);
  }
})();
