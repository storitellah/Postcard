const { chromium } = require('playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Postcard';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(p)]||'x'});res.end(d);});});
const results=[]; const ok=(n,p,x='')=>{results.push({n,p});console.log((p?'PASS':'FAIL')+'  '+n+(x?'  — '+x:''));};
(async()=>{
  await new Promise(r=>server.listen(8899,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const page=await b.newPage({viewport:{width:1440,height:900}});
  const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://localhost:8899/index.html'); await page.waitForTimeout(500);
  await page.click('#btnEmptyDemo');
  await page.waitForFunction(()=>window.PostcardPress&&PostcardPress.state.cards.length===3,null,{timeout:15000});
  ok('Demo loads 3 cards', true);
  const jpg=await page.evaluate(async()=>{const S=PostcardPress;const c=S.renderCardSide(S.state.cards[0],'front',300,{bleed:true,marks:true,export:true});const by=await S.canvasToBytes(c,'jpg');return{w:c.width,dpi:(by[13]===1&&(by[14]<<8|by[15])===300)};});
  ok('JPG 300 DPI export', jpg.dpi && jpg.w>1800, `w=${jpg.w}`);
  const pdf=await page.evaluate(async()=>{const S=PostcardPress;const blob=await S.buildCardsPdf(S.state.cards,['front','back'],{bleed:true,marks:true});const buf=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=0x8000)s+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));return{ok:s.slice(0,5)==='%PDF-',pages:(s.match(/\/Type \/Page[^s]/g)||[]).length};});
  ok('PDF valid, 6 pages', pdf.ok && pdf.pages===6, `pages=${pdf.pages}`);
  const rt=await page.evaluate(async()=>{const S=PostcardPress;const j=JSON.stringify(S.serializeProject());await S.loadProjectData(JSON.parse(j));return S.state.cards.length;});
  ok('Backup/restore round-trip (with exif field)', rt===3);
  // demo cards have no exif → applyTokens returns empty, no crash
  const tokSafe=await page.evaluate(()=>PostcardPress.applyTokens('{camera}{lens}{settings}',PostcardPress.state.cards[0]));
  ok('Tokens safe when no EXIF', tokSafe==='', JSON.stringify(tokSafe));
  await page.click('#btnTheme'); await page.waitForTimeout(300);
  ok('Dark theme toggles', await page.evaluate(()=>document.documentElement.dataset.theme)==='dark');
  await page.click('#btnTheme');
  // QR toggle via UI
  await page.click('.insp-tab[data-page="back"]');
  await page.click('#bQrOn'); await page.waitForTimeout(300);
  const qrUi=await page.evaluate(()=>({controls:!document.getElementById('qrControls').hidden, hasQr:PostcardPress.state.cards[PostcardPress.state.sel].back.elements.some(e=>e.type==='qr')}));
  ok('QR toggle shows controls + adds element', qrUi.controls && qrUi.hasQr);
  ok('No console errors', errors.length===0, errors.slice(0,2).join(' | '));
  await b.close(); server.close();
  const fails=results.filter(r=>!r.p);
  console.log(`\n${results.length-fails.length}/${results.length} checks passed`);
  process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
