// Packout bin blueprint: add a Packout Deep Organizer (4 small compartments in back, 4 large in front, no center slot), label bins, link items,
// split bins horizontally/vertically into N even sections, combine and break bins, refill integration, reload.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||p.endsWith('sw.js')){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});fs.createReadStream(f).pipe(res)});
let fails=0;const ok=(c,m)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+m)};
const SHOTS=process.env.SHOTS||require('os').tmpdir();
server.listen(0,async()=>{
  const url=`http://127.0.0.1:${server.address().port}/`;const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route(/fonts\./,r=>r.abort());await p.goto(url);await p.waitForTimeout(400);await p.click('[data-start=van]');
  await p.click('#tabs [data-tab=bins]');
  ok(await p.isVisible('#vBins .empty'),'empty state offers to add an organizer');
  await p.click('#vBins .empty [data-act=orgNew]');
  ok(await p.locator('#o_prev .bsec').count()===8,'preview: 4 small + 4 large');
  await p.fill('#o_name','PEX Packout');await p.click('#o_save');await p.waitForTimeout(150);
  const secs=()=>p.locator('#vBins .pk-in .bsec').count();
  ok(await secs()===8,'blueprint drawn: 8 bins');
  const ratio=await p.evaluate(()=>{const r=document.querySelector('#vBins .pk').getBoundingClientRect();return r.width/r.height});
  ok(Math.abs(ratio-19.7/15.2)<0.02,`organizer drawn at real 19.7 x 15.2 proportions (${ratio.toFixed(3)})`);
  ok(await p.locator('#vBins .bsec[data-bin^=r1c]').count()===4&&await p.locator('#vBins .bsec[data-bin^=L]').count()===4,'4 small bins in back, 4 large in front');
  ok(await p.locator('#vBins .bin.slot').count()===0,'no center slot');
  ok(await p.locator('#vBins .pk.deep').count()===1&&(await p.textContent('#vBins .pkdims')).includes('Deep Organizer'),'drawn as the Deep Organizer');
  const hs=await p.evaluate(()=>[document.querySelector('#vBins .bsec[data-bin=r1c1]').getBoundingClientRect().height,document.querySelector('#vBins .bsec[data-bin=L1]').getBoundingClientRect().height]);
  ok(hs[1]>hs[0]*1.8,'large bins are two small bins deep');
  // label-only bin -> Low
  await p.click('#vBins .bsec[data-bin=L1]');await p.fill('#b_label','1/2 PEX rings');await p.press('#b_label','Enter');
  await p.click('[data-blv=Low]');await p.click('.sheet .stick [data-close]');await p.waitForTimeout(120);
  ok(await p.locator('#vBins .bsec[data-bin=L1].st-Low').count()===1&&(await p.textContent('#vBins .bsec[data-bin=L1]')).includes('1/2 PEX rings'),'label-only bin shows label and turns Low');
  // linked items -> worst level wins
  await p.click('#vBins .bsec[data-bin=L4]');await p.fill('#b_find','1/2 pex coupling');await p.waitForTimeout(200);await p.locator('#b_res .pick').first().click();
  await p.fill('#b_find','1/2 pex tee');await p.waitForTimeout(200);await p.locator('#b_res .pick').first().click();
  await p.locator('#b_body .row').nth(1).locator('.rbtn').click();await p.locator('#b_body .row').nth(1).locator('[data-lv=Out]').click();await p.waitForTimeout(80);
  await p.click('.sheet .stick [data-close]');await p.waitForTimeout(120);
  ok(await p.locator('#vBins .bsec[data-bin=L4].st-Out').count()===1,'bin shows worst level of its items (Out)');
  // dividers: front left -> vertical 3, then horizontal 2
  await p.click('#vBins .bsec[data-bin=L1]');await p.click('#b_dir [data-dir=v]');await p.click('#b_cnt [data-n="3"]');await p.waitForTimeout(80);
  ok(await p.locator('#vBins .bsec[data-bin=L1]').count()===3&&await p.locator('#vBins .bin.v .bsec[data-bin=L1]').count()===3,'split vertically into 3 even sections');
  ok((await p.textContent('#vBins .bsec[data-bin=L1][data-sec=a]')).includes('1/2 PEX rings')&&await p.locator('#vBins .bsec[data-bin=L1][data-sec=b].st-none').count()===1,'first section keeps its contents, new sections start empty');
  await p.click('#b_dir [data-dir=h]');await p.click('#b_cnt [data-n="2"]');await p.waitForTimeout(80);
  ok(await p.locator('#vBins .bin.h .bsec[data-bin=L1]').count()===2,'switch to horizontal, 2 sections');
  await p.click('.sheet .stick [data-close]');
  await p.click('#vBins .bsec[data-bin=r1c1]');await p.click('#b_dir [data-dir=v]');await p.click('#b_cnt [data-n="4"]');await p.click('.sheet .stick [data-close]');await p.waitForTimeout(80);
  ok(await p.locator('#vBins .bsec[data-bin=r1c1]').count()===4,'small bin split into 4');
  // combine two small middle bins, then break apart
  await p.click('#vBins .bsec[data-bin=r1c2]');const btn=p.locator('#b_merge [data-merge=right]');ok(await btn.count()===1,'offers to combine with the bin beside it');
  await btn.click();await p.waitForTimeout(120);ok(await p.locator('#vBins .bsec[data-bin=m12w]').count()===1&&await p.locator('#vBins .bsec[data-bin=r1c3]').count()===0,'two small bins combined into one large');
  await p.click('#vBins .bsec[data-bin=m12w]');await p.click('#b_merge [data-merge=break]');await p.waitForTimeout(120);
  ok(await p.locator('#vBins .bsec[data-bin=r1c2]').count()===1&&await p.locator('#vBins .bsec[data-bin=r1c3]').count()===1,'large bin broken back into 2 small');
  await p.click('#vBins .bsec[data-bin=L3]');await p.click('#b_merge [data-merge=break]');await p.waitForTimeout(100);
  ok(await p.locator('#vBins .bsec[data-bin=r2c3]').count()===1&&await p.locator('#vBins .bsec[data-bin=r3c3]').count()===1,'a front large bin can be broken into 2 small');
  await p.screenshot({path:path.join(SHOTS,'bins.png')});
  // refill + where
  await p.click('#tabs [data-tab=refill]');
  ok((await p.textContent('#vRefill')).includes('1/2 PEX rings'),'label-only Low bin on Refill');
  ok((await p.textContent('#vRefill')).includes('PEX Packout · Front 4'),'items show which bin they live in');
  await p.reload();await p.waitForTimeout(400);await p.click('#tabs [data-tab=bins]');
  ok(await p.locator('#vBins .bin.h .bsec[data-bin=L1]').count()===2&&await p.locator('#vBins .bsec[data-bin=r1c1]').count()===4,'layout and dividers saved after reload');
  // old organizers still show
  await p.evaluate(()=>{orgWrite('van',{list:{old1:{name:'Old layout',layout:'o11',ord:1,bins:{f2:{a:{label:'Old front 2',lvl:'Out'}}}}}});renderAll();});
  await p.click('#vBins [data-org=old1]');await p.waitForTimeout(100);
  ok((await p.textContent('#vBins .bsec[data-bin=f2]')).includes('Old front 2'),'organizers made with earlier layouts keep their bins');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll');
  await p.setViewportSize({width:360,height:740});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 360px');
  ok(!errs.length,'no page errors '+errs.join('; '));
  await b.close();server.close();process.exit(fails?1:0);
});
