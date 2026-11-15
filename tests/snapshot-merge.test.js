// Checks that changes copied over from the Claude copy (data/claude-snapshot.json) show up on GitHub Pages:
// 1) on a phone opening the app for the first time, 2) on a phone that already has its own data,
// where a change made on the phone more recently than the snapshot must be kept.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const snap=JSON.parse(fs.readFileSync(path.join(root,'data/claude-snapshot.json')));
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||p.endsWith('sw.js')){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});fs.createReadStream(f).pipe(res)});
let fails=0;const ok=(c,m)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+m)};
// pick facts from the snapshot to look for
const vanItems=Object.values(snap.van).flatMap(d=>d.items?Object.entries(d.items).map(([id,it])=>({id,...it,cat:d.cat})):[]);
const leveled=vanItems.filter(i=>i.lvl&&!i.hidden&&!i.gone);const hiddenOne=vanItems.find(i=>i.hidden&&i.dAt);
server.listen(0,async()=>{
  const url=`http://127.0.0.1:${server.address().port}/`;const b=await chromium.launch();
  const open=async(prep)=>{const ctx=await b.newContext({viewport:{width:360,height:740}});const p=await ctx.newPage();await p.route(/fonts\./,r=>r.abort());
    if(prep){await p.goto(url);await p.evaluate(prep);}await p.goto(url);await p.waitForTimeout(500);await p.evaluate(()=>{localStorage.setItem('pi2.loc','"van"')});await p.reload();await p.waitForTimeout(500);return p};
  const lvlOf=(p,id)=>p.evaluate(id=>{const it=items('van').find(i=>i.id===id);return it?[it.name,it.lvl,!!it.hidden]:null},id);
  // 1) fresh phone
  let p=await open();
  let good=0;for(const it of leveled){const r=await lvlOf(p,it.id);if(r&&r[1]===it.lvl&&r[0]===it.name)good++}
  ok(good===leveled.length,`fresh phone: all ${leveled.length} stock levels and names from Claude copy present (${good})`);
  ok((await lvlOf(p,hiddenOne.id))[2]===true,'fresh phone: hidden items stay hidden');
  ok(await p.evaluate(()=>items('van').some(i=>i.cat==='Drain Cleaning'&&i.name==='Drain banger')),'fresh phone: new category Drain Cleaning present');
  ok(await p.evaluate(()=>items('shop').every(i=>!i.lvl&&!i.hidden)),'shop untouched (still blank)');
  // 2) phone with its own older data + one newer local change
  const target=leveled[0];
  p=await open(t=>{localStorage.clear()});  // first run creates local data from the starter list...
  await p.evaluate(t=>{const v=JSON.parse(localStorage.getItem('pi2.local.van'));for(const d of Object.values(v)){if(d.items&&d.items[t.id]){d.items[t.id].lvl='Extra';d.items[t.id].sAt=Date.now()+1e6;d.items[t.id].sDev='phone'}}
    localStorage.setItem('pi2.local.van',JSON.stringify(v));localStorage.removeItem('pi2.snapApplied')},target);
  await p.reload();await p.waitForTimeout(500);
  ok((await lvlOf(p,target.id))[1]==='Extra','newer change made on the phone is kept');
  const other=leveled[1];ok((await lvlOf(p,other.id))[1]===other.lvl,'other Claude changes still merged in');
  await p.reload();await p.waitForTimeout(300);ok(await p.evaluate(()=>!!localStorage.getItem('pi2.snapApplied')),'merge runs once (marked as applied)');
  await b.close();server.close();process.exit(fails?1:0);
});
