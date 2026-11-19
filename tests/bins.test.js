// Packout bin blueprint: add an organizer (9-bin layout: front row is 2 wide bins), put items in bins,
// check that bin colors follow stock levels, label-only bins show on Refill, and items show which bin they live in.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||p.endsWith('sw.js')){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'application/octet-stream'});fs.createReadStream(f).pipe(res)});
let fails=0;const ok=(c,m)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+m)};
server.listen(0,async()=>{
  const url=`http://127.0.0.1:${server.address().port}/`;const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:360,height:740},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route(/fonts\./,r=>r.abort());await p.goto(url);await p.waitForTimeout(400);await p.click('[data-start=van]');
  await p.click('#tabs [data-tab=bins]');
  ok(await p.isVisible('#vBins .empty'),'empty state offers to add an organizer');
  await p.click('#vBins .empty [data-act=orgNew]');
  ok(await p.locator('#o_prev .sec').count()===9,'preview: 9 bins, front row is 2 wide sections');
  await p.check('#o_split');ok(await p.locator('#o_prev .sec').count()===11,'optional: split each front bin in half');await p.uncheck('#o_split');
  await p.fill('#o_name','PEX Packout');await p.click('#o_save');await p.waitForTimeout(150);
  ok(await p.locator('#vBins .ogrid .sec').count()===9,'blueprint drawn with 9 bins');
  ok(await p.locator('#vBins .sec[data-bin=fl]').count()===1&&await p.locator('#vBins .sec[data-bin=fr]').count()===1,'front row: Front left and Front right');
  // label-only bin: Front left -> Low
  await p.click('#vBins .sec[data-bin=fl]');await p.fill('#b_label','1/2 PEX rings');await p.press('#b_label','Enter');
  await p.click('[data-blv=Low]');await p.click('.sheet .stick [data-close]');await p.waitForTimeout(150);
  ok(await p.locator('#vBins .sec[data-bin=fl].st-Low').count()===1,'label-only bin turns Low (orange)');
  ok((await p.textContent('#vBins .sec[data-bin=fl]')).includes('1/2 PEX rings'),'bin shows its label');
  // linked items: Middle right gets two items; worst level wins
  await p.click('#vBins .sec[data-bin=mr]');await p.fill('#b_find','1/2 pex coupling');await p.waitForTimeout(200);
  await p.locator('#b_res .pick').first().click();await p.fill('#b_find','1/2 pex tee');await p.waitForTimeout(200);await p.locator('#b_res .pick').first().click();
  ok(await p.locator('#b_body .row').count()===2,'two items linked to the bin');
  await p.locator('#b_body .row').nth(0).locator('.rbtn').click();await p.locator('#b_body .row').nth(0).locator('[data-lv=Stocked]').click();await p.waitForTimeout(80);
  await p.locator('#b_body .row').nth(1).locator('.rbtn').click();await p.locator('#b_body .row').nth(1).locator('[data-lv=Out]').click();await p.waitForTimeout(80);
  await p.click('.sheet .stick [data-close]');await p.waitForTimeout(150);
  ok(await p.locator('#vBins .sec[data-bin=mr].st-Out').count()===1,'bin shows the worst level of its items (Out)');
  ok((await p.textContent('#vBins .summary')).includes('2 low'),'summary counts 2 low bins');
  await p.screenshot({path:path.join(require('os').tmpdir(),'bins.png')});
  // refill tab shows the label-only bin and the Out item
  await p.click('#tabs [data-tab=refill]');
  ok((await p.textContent('#vRefill')).includes('1/2 PEX rings'),'label-only Low bin listed on Refill');
  ok(await p.locator('#vRefill .row .pill.Out').count()>=1,'Out item listed on Refill');
  ok((await p.textContent('#vRefill')).includes('PEX Packout · Middle right'),'items show which bin they live in');
  // split / merge
  await p.click('#tabs [data-tab=bins]');await p.click('#vBins .sec[data-bin=b1]');await p.click('#b_split');await p.waitForTimeout(100);
  ok(await p.locator('#vBins .sec[data-bin=b1]').count()===2,'any bin can be split');
  // survives reload
  await p.reload();await p.waitForTimeout(400);await p.click('#tabs [data-tab=bins]');
  ok(await p.locator('#vBins .sec[data-bin=fl].st-Low').count()===1&&await p.locator('#vBins .sec[data-bin=b1]').count()===2,'bin map saved after reload');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 360px');
  // organizers made with the earlier 11-bin layout still show correctly
  await p.evaluate(()=>{orgWrite('van',{list:{old1:{name:'Old layout',layout:'o11',ord:1,bins:{f2:{a:{label:'Old front 2',lvl:'Out'}}}}}});renderAll();});
  await p.click('#vBins [data-org=old1]');await p.waitForTimeout(100);
  ok(await p.locator('#vBins .ogrid .sec').count()===11&&(await p.textContent('#vBins .sec[data-bin=f2]')).includes('Old front 2'),'old 11-bin organizers keep their bins');
  ok(!errs.length,'no page errors '+errs.join('; '));
  await b.close();server.close();process.exit(fails?1:0);
});
