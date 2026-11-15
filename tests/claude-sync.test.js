// Simulates the Claude storage with three phones (two owner phones, one crew viewer) and checks
// separation, setup hiding, search, add, requests, access rules, offline saving and conflicts.
// Run: npm install && npm test
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const SEED=path.join(__dirname,'..','data','seed');
const srv=new Map();for(const f of fs.readdirSync(SEED)){const [loc,id]=f.replace('.json','').split('_');srv.set(loc+'/'+id,JSON.parse(fs.readFileSync(SEED+'/'+f)))}
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const dm=(a,b)=>{const o=isObj(a)?{...a}:{};for(const k in b)o[k]=isObj(b[k])?dm(isObj(o[k])?o[k]:{},b[k]):b[k];return o};
function canRead(role,p){const c=p.split('/')[0];return role==='owner'||c==='shop'||(c==='requests')}
function canWrite(role,p){const c=p.split('/')[0];return role==='owner'||c==='requests'}
let writes=0;const ver={van:1,shop:1,requests:1};
function handle(op,p,d,role){
  if(op==='list'){if(d===ver[p]+':'+role)return {v:d};return {v:ver[p]+':'+role,docs:[...srv].filter(([k])=>k.split('/')[0]===p&&canRead(role,k)).map(([k,v])=>[k.split('/')[1],v])}}
  if(op==='get')return canRead(role,p)?(srv.get(p)??null):null;
  if(!canWrite(role,p))return 'invalid_argument';writes++;ver[p.split('/')[0]]++;
  if(op==='set')srv.set(p,JSON.parse(JSON.stringify(d)));
  else if(op==='update'){if(!srv.has(p))return 'invalid_argument';srv.set(p,dm(srv.get(p),d))}
  else if(op==='delete')srv.delete(p);
  return null;
}
const INIT=`(()=>{const R=JSON.parse(localStorage.getItem('__fake')||'{}');window.__role=R.role;window.__uid=R.uid;
 Object.defineProperty(window,'__offline',{get(){return localStorage.getItem('__off')==='1'},set(v){localStorage.setItem('__off',v?'1':'0')}});
 const E=c=>Object.assign(new Error(c),{code:c});const call=(...a)=>window.__srv(...a);
 const db={doc(p){return{path:p,id:p.split('/').pop(),
   async get(){if(__offline)throw E('unavailable');const d=await call('get',p,null,__role);return{id:this.id,exists:d!=null,data:()=>d,metadata:{}}},
   async set(d){if(__offline)throw E('unavailable');const r=await call('set',p,d,__role);if(r)throw E(r)},
   async update(d){if(__offline)throw E('unavailable');const r=await call('update',p,d,__role);if(r)throw E(r)},
   async delete(){if(__offline)throw E('unavailable');const r=await call('delete',p,null,__role);if(r)throw E(r)}}},
  collection(c){const q={limit(){return q},onSnapshot(next){let last=null;const tick=async()=>{if(__offline)return;const r=await call('list',c,last,__role);if(r.docs){last=r.v;const docs=r.docs;next({docs:docs.map(([id,d])=>({id,exists:true,data:()=>d})),metadata:{fromCache:false}})}};tick();const h=setInterval(tick,300);return()=>clearInterval(h)}};return q}};
 const user={isOwner:async()=>__role==='owner',id:async()=>__uid,can:async()=>null,profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{id:i,name:i==='u_jordan'?'Jordan':'Lucas',isMe:i===__uid}]))};
 if(R.role)window.claude={use:async n=>n==='db'?db:n==='user'?user:null};})()`;
// Served over http like the real site (Chromium can drop localStorage across reloads of file:// pages).
const http=require('http');const ROOT=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||p.endsWith('sw.js')){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});fs.createReadStream(f).pipe(res)}).listen(0);
let url;
let fails=0;const ok=(c,m)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+m)};
async function phone(b,role,uid){const ctx=await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:2});await ctx.exposeFunction('__srv',handle);
  await ctx.addInitScript(`localStorage.setItem('__fake',${JSON.stringify(JSON.stringify({role,uid}))})`);await ctx.addInitScript(INIT);const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(url);await p.waitForTimeout(700);return p}
const names=p=>p.$$eval('#vStock .row',rs=>rs.map(r=>(r.querySelector('.size')?.textContent||'')+' '+r.querySelector('.nm').childNodes[0].textContent.trim()));
async function search(p,q){await p.fill('#q',q);await p.waitForTimeout(200);return names(p)}
const row=(p,id)=>p.locator(`#vStock .row[data-id="${id}"]`);
(async()=>{
await new Promise(r=>server.listening?r():server.once('listening',r));url=`http://127.0.0.1:${server.address().port}/index.html`;
const b=await chromium.launch();
const A=await phone(b,'owner','u_jordan');
ok(await A.isVisible('#startScreen'),'owner: start screen');
await A.click('[data-start=van]');
ok(/Setting up Van/.test(await A.textContent('#vStock')),'setup banner');
// size parsing
for(const q of ['1/2 inch','1/2 inch PEX','½ pex','half inch pex','.5 pex','1/2" pex','1 1/2 san tee','inch and a half san tee','3x2 wye','3/4 ball valve']){const r=await search(A,q);console.log(`  "${q}" -> ${r.length}: ${r.slice(0,3).join(' | ')}`)}
const h1=await search(A,'1/2 inch'),h2=await search(A,'1/2 inch pex'),h3=await search(A,'½ pex'),h4=await search(A,'half inch pex');
ok(h2.length<h1.length&&h2.length===h3.length&&h3.length===h4.length,'narrowing + ½/half equivalence');
ok(!h1.some(x=>x.startsWith('1-1/2 ')&&!x.includes('x')),'1/2 does not match 1-1/2');
// category chip
await search(A,'tee');const allTee=(await names(A)).length;await A.click('#rail [data-g="PEX"]');const pexTee=(await names(A)).length;ok(pexTee<allTee&&pexTee>0,`PEX chip narrows tees ${allTee}->${pexTee}`);
await A.click('#rail [data-g="PEX"]');
// quick update
await search(A,'1/2 pex 90');const firstId=await A.locator('#vStock .row').first().getAttribute('data-id');
await A.locator('#vStock .row').first().locator('.rbtn').click();await row(A,firstId).locator('[data-lv=Low]').click();
ok(await row(A,firstId).locator('.pill.Low').count()===1,'one-tap Low from suggestion');
ok((await A.textContent('#tabs [data-tab=refill]')).includes('1'),'van refill badge 1');
await A.click('#locShop');await A.waitForTimeout(200);
ok(!/Refill\d/.test((await A.textContent('#tabs [data-tab=refill]')).replace(/\s/g,'')),'shop refill empty');
await search(A,'1/2 pex 90');ok(await row(A,firstId).locator('.pill.None').count()===1,'same item in shop still Not set (separate)');
await A.click('#locVan');
// set a few more & mark one Out, then finish setup
await search(A,'3 san tee');const sid=await A.locator('#vStock .row').first().getAttribute('data-id');await row(A,sid).locator('.rbtn').click();await row(A,sid).locator('[data-lv=Out]').click();
await search(A,'');
await A.click('[data-act=finishSetup]');await A.click('#cOk');await A.waitForTimeout(500);
const vis=await A.textContent('#vStock .summary');ok(/^2 items/.test(vis.trim()),'after setup only set items visible: '+vis.trim());
ok((await A.textContent('#tabs [data-tab=refill]')).includes('2'),'Out item stays and is on refill (2)');
let r=await search(A,'1/2 pex tee');ok(await A.isVisible('.hidmatch'),'hidden matches offered: '+await A.textContent('.hidmatch'));
await A.click('.hidmatch');const hid=A.locator('#vStock .row:has(.pill.Hidden)').first();const hidId=await hid.getAttribute('data-id');
await hid.locator('.rbtn').click();await row(A,hidId).locator('[data-act=unhide]').click();await A.waitForTimeout(150);
await search(A,'');ok(/^3 items/.test((await A.textContent('#vStock .summary')).trim()),'restore hidden -> 3 visible');
// plus-add with similar items present
await search(A,'1/2-inch PEX wye');await A.click('[data-act=add]');
console.log('  add prefill:',await A.inputValue('#a_name'),'|',await A.inputValue('#a_size'),'|',await A.inputValue('#a_cat'));
await A.click('#a_lvls [data-lv=Low]');await A.click('#a_save');await A.waitForTimeout(200);
r=await names(A);ok(r.some(x=>/1\/2 Wye/.test(x)),'added item shown: '+r.join(';'));
// multi add
await search(A,'');await A.click('[data-act=add]');await A.click('#a_toggle');await A.fill('#a_lines','1/2 test cap A\n3/4 test cap B\n1/2 test cap A');await A.selectOption('#a_cat','Uponor PEX / ProPEX');await A.click('#a_save');
console.log('  multi toast:',await A.textContent('#toast'));
// bulk hide in shop
await A.click('#locShop');await search(A,'black nipple');await A.click('[data-act=bulk]');
const rows=A.locator('#vStock .row');await rows.nth(0).locator('.rbtn').click();await rows.nth(1).locator('.rbtn').click();await rows.nth(2).locator('.rbtn').click();
ok((await A.textContent('#selN'))==='3 selected','select 3');await A.click('#selMain');await A.click('#cOk');await A.waitForTimeout(200);
await search(A,'black nipple');ok((await names(A)).length===24,'3 hidden, 24 left of 27');

// ---- "? Not sure" status and To check list (van, after setup)
await A.click('#locVan');await search(A,'test cap');const uid1=await A.locator('#vStock .row').first().getAttribute('data-id');
await A.locator('#vStock .row').first().locator('.rbtn').click();await row(A,uid1).locator('[data-act=unsure]').click();
ok(await row(A,uid1).locator('.pill.Check').count()===1,'Not sure shows Check pill');
await A.click('#tabs [data-tab=refill]');await A.click('[data-rv=check]');
ok(await A.locator(`#vRefill .row[data-id="${uid1}"]`).count()===1,'item on To check list');
await A.click('[data-rv=refill]');ok(await A.locator(`#vRefill .row[data-id="${uid1}"]`).count()===0,'Not sure item is not on refill list');
await A.click('[data-rv=check]');await A.locator(`#vRefill .row[data-id="${uid1}"] .rbtn`).click();await A.locator(`#vRefill .row[data-id="${uid1}"] [data-lv=Half]`).click();
await A.click('#tabs [data-tab=stock]');await A.click('#tabs [data-tab=refill]');await A.click('[data-rv=check]');
ok(await A.locator('#vRefill .row').count()===0,'picking a real level clears it from To check');
await A.click('#tabs [data-tab=stock]');await A.click('#locShop');
// ---- viewer
const C=await phone(b,'viewer','u_lucas');
ok(await C.isHidden('#locSeg')&&await C.isHidden('#startScreen'),'viewer: no van switch');
await C.waitForTimeout(300);ok((await C.textContent('#vStock .summary')).includes('Shop'),'viewer sees shop');
await search(C,'3/4 pex tee');const cid=await C.locator('#vStock .row').first().getAttribute('data-id');await C.locator('#vStock .row').first().locator('.rbtn').click();
ok(await row(C,cid).locator('[data-lv]').count()===0,'viewer has no level buttons');
await row(C,cid).locator('[data-act=reqLow]').click();await C.fill('#r_text','2 left on shelf');await C.fill('#r_from','Lucas');await C.click('#r_send');await C.waitForTimeout(500);
ok([...srv.keys()].some(k=>k.startsWith('requests/')),'request stored on server');
ok(handle('set','shop/c01',{x:1},'viewer')==='invalid_argument'&&handle('list','van',null,'viewer').docs.length===0,'rules: viewer cannot write shop or read van');

// owner reviews
await A.waitForTimeout(500);0&&console.log('DBG',await A.evaluate(()=>[S.remote.requests.size,S.docs.requests.size,S.role,S.mode,JSON.stringify([...S.docs.requests.values()])]), [...srv.keys()].filter(k=>k.startsWith('req')));ok((await A.textContent('#tabs [data-tab=req]')).includes('1'),'owner request badge');
await A.click('#tabs [data-tab=req]');
const rq=A.locator('.req').first();ok((await rq.textContent()).includes('2 left on shelf'),'request text shown');
ok((await rq.locator('.pill').textContent())==='Not set','request did not change inventory');
await rq.locator('.rbtn').click();await A.locator('.req').first().locator('[data-lv=Low]').click();await A.waitForTimeout(100);
await A.locator('.req').first().locator('[data-act=reqDone]').click();await A.waitForTimeout(600);
await C.click('#tabs [data-tab=req]');await C.waitForTimeout(400);ok((await C.textContent('#vReq')).includes('Done'),'viewer sees Done');
await C.click('#tabs [data-tab=stock]');await search(C,'3/4 pex tee');ok(await row(C,cid).locator('.pill.Low').count()===1,'viewer sees shop level updated by owner');
// ---- offline + conflict between two owner phones
const B=await phone(b,'owner','u_jordan');await B.click('[data-start=shop]');
await A.click('#tabs [data-tab=stock]');await search(A,'1 copper coupling');const xid=await A.locator('#vStock .row').first().getAttribute('data-id');
await A.evaluate(()=>window.__offline=true);await A.waitForTimeout(300);
await row(A,xid).locator('.rbtn').click();await row(A,xid).locator('[data-lv=Stocked]').click();
ok((await A.textContent('#syncTxt')).includes('Offline'),'A offline indicator: '+await A.textContent('#syncTxt'));
// A reloads while offline: change must survive
await A.reload();await A.waitForTimeout(500);await search(A,'1 copper coupling');ok(await row(A,xid).locator('.pill.Stocked').count()===1,'offline change survives reload');
await A.waitForTimeout(50);
await search(B,'1 copper coupling');await row(B,xid).locator('.rbtn').click();await row(B,xid).locator('[data-lv=Out]').click();await B.waitForTimeout(400);
await A.evaluate(()=>window.__offline=false);await A.evaluate(()=>dispatchEvent(new Event('online')));await A.waitForTimeout(1500);
const srvIt=Object.values(srv).length;const it=[...srv].map(([k,v])=>v.items&&k.startsWith('shop/')&&v.items[xid]).find(Boolean);
console.log('  server value after sync:',it.lvl,' A conflicts:',await A.evaluate(()=>JSON.parse(localStorage.getItem('pi2.conflicts')).length));
ok(it.lvl==='Out','newer change (Out from B) kept');
await A.click('#tabs [data-tab=more]');
ok(await A.locator('.conf').count()===1,'conflict shown, not silent');
await A.click('[data-act=useAlt]');await A.waitForTimeout(800);
const it2=[...srv].map(([k,v])=>v.items&&k.startsWith('shop/')&&v.items[xid]).find(Boolean);ok(it2.lvl==='Stocked','Use other value -> Stocked on server');
// viewer offline request queued
await C.evaluate(()=>window.__offline=true);await C.click('#tabs [data-tab=req]');await C.click('#vReq [data-act=reqFree]');await C.fill('#r_text','Need a box of 1/2 PEX rings');await C.click('#r_send');
console.log('  viewer offline toast:',await C.textContent('#toast'));const before=[...srv.keys()].filter(k=>k.startsWith('requests/')).length;
await C.evaluate(()=>{window.__offline=false;dispatchEvent(new Event('online'))});await C.waitForTimeout(800);
ok([...srv.keys()].filter(k=>k.startsWith('requests/')).length===before+1,'offline request delivered later');
// shop: Not sure survives Finish setup (bulk-set via Select)
await A.click('#tabs [data-tab=stock]');await A.click('#locShop');await A.click('#tabs [data-tab=stock]');await search(A,'3/4 copper coupling');await A.click('[data-act=bulk]');
await A.locator('#vStock .row').nth(0).locator('.rbtn').click();await A.click('#selLevel');await A.click('.sheet [data-lv=Check]');await A.waitForTimeout(150);
const cid0=await A.locator('#vStock .row').first().getAttribute('data-id');
await search(A,'');await A.click('#vStock [data-act=finishSetup]');await A.click('#cOk');await A.waitForTimeout(300);
await search(A,'3/4 copper coupling');ok(await row(A,cid0).locator('.pill.Check').count()===1,'Not sure item stays visible after Finish setup');
await A.click('#tabs [data-tab=refill]');await A.click('[data-rv=check]');await A.screenshot({path:path.join(require('os').tmpdir(),'check-list.png')});
await A.click('[data-rv=refill]');await A.click('#tabs [data-tab=stock]');
// layout
for(const p of [A,C]){ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll')}
await A.click('#tabs [data-tab=stock]');await search(A,'');await A.locator('#vStock .row').first().locator('.rbtn').click();
await A.click('#tabs [data-tab=refill]');
await A.click('#tabs [data-tab=stock]');await search(A,'');await A.click('[data-act=add]');await A.waitForTimeout(250);
const errs=[...A.errs,...B.errs,...C.errs];ok(!errs.length,'no page errors '+errs.join('; '));await b.close();process.exit(fails?1:0)})();
