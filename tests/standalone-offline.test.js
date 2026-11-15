// Serves index.html over http (like GitHub Pages), then checks that the app keeps working
// with the network cut: reload offline, search, change a level, reload again.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)});
let fails=0;const ok=(c,m)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+m)};
server.listen(0,async()=>{
  const url=`http://127.0.0.1:${server.address().port}/`;
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:740}});const p=await ctx.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await p.goto(url);await p.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller,null,{timeout:10000}).catch(()=>{});
  await p.reload();await p.waitForTimeout(500);
  ok(await p.evaluate(()=>!!navigator.serviceWorker.controller),'service worker active');
  await p.click('[data-start=van]');
  await ctx.setOffline(true);
  await p.reload();await p.waitForTimeout(500);
  ok(await p.isVisible('#q'),'app loads with no network');
  await p.fill('#q','1/2 pex 90');await p.waitForTimeout(200);
  const first=p.locator('#vStock .row').first();const id=await first.getAttribute('data-id');
  await first.locator('.rbtn').click();await p.locator(`#vStock .row[data-id="${id}"] [data-lv=Out]`).click();
  await p.reload();await p.waitForTimeout(500);await p.fill('#q','1/2 pex 90');await p.waitForTimeout(200);
  ok(await p.locator(`#vStock .row[data-id="${id}"] .pill.Out`).count()===1,'offline change saved on the phone');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 360px');
  await b.close();server.close();process.exit(fails?1:0);
});
