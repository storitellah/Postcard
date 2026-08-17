const { chromium } = require('playwright-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const { buildExifApp1 } = require('./exifbuilder.js');
const ROOT = '/home/user/Postcard';
const SAMPLES = path.join(ROOT, 'samples');
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png' };
const server = http.createServer((req,res)=>{ let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0])); if(p.endsWith('/'))p+='index.html'; fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); res.end(d);});});
const results=[]; const ok=(n,p,x='')=>{results.push({n,p,x});console.log((p?'PASS':'FAIL')+'  '+n+(x?'  — '+x:''));};

(async()=>{
  await new Promise(r=>server.listen(8899,r));
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const page = await browser.newPage({ viewport:{width:1440,height:900} });
  const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://localhost:8899/index.html');
  await page.waitForTimeout(500);

  // vendored libs present
  const libs = await page.evaluate(()=>({ exifr: typeof window.exifr, qrcode: typeof window.QRCode, create: !!(window.QRCode&&window.QRCode.create) }));
  ok('Vendored exifr loaded', libs.exifr==='object'||libs.exifr==='function', libs.exifr);
  ok('Vendored node-qrcode loaded (sync create)', libs.qrcode==='object'&&libs.create, `${libs.qrcode}`);

  // Build an EXIF JPEG in-browser and import it through the real pipeline
  const app1 = buildExifApp1({ make:'FUJIFILM', model:'X-T5', lens:'XF35mmF1.4 R', focal:35, fnum:1.4, exp:1/500, iso:200, date:'2026:03:15 18:42:10' });
  const exif = await page.evaluate(async (app1arr)=>{
    // base canvas jpeg
    const c=document.createElement('canvas'); c.width=1200;c.height=800; const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,800); g.addColorStop(0,'#264653');g.addColorStop(1,'#e9c46a'); x.fillStyle=g;x.fillRect(0,0,1200,800);
    const durl=c.toDataURL('image/jpeg',0.9);
    const base=Uint8Array.from(atob(durl.split(',')[1]), ch=>ch.charCodeAt(0));
    // inject APP1 after the JFIF APP0 segment (standard order)
    const app1=Uint8Array.from(app1arr);
    let insertAt=2;
    if(base[2]===0xFF && base[3]===0xE0){ const len=(base[4]<<8)|base[5]; insertAt=2+2+len; }
    const out=new Uint8Array(insertAt+app1.length+(base.length-insertAt));
    out.set(base.subarray(0,insertAt),0); out.set(app1,insertAt); out.set(base.subarray(insertAt),insertAt+app1.length);
    const file=new File([out],'DSCF1234.jpg',{type:'image/jpeg'});
    await window.PostcardPress.handleFiles([file]);
    const card=window.PostcardPress.currentCard();
    return { exif: card.exif, metaCamera: card.meta.camera, metaDate: card.meta.date };
  }, app1);
  ok('EXIF camera parsed', exif.exif && exif.exif.camera==='FUJIFILM X-T5', exif.exif&&exif.exif.camera);
  ok('EXIF lens parsed', exif.exif && exif.exif.lens==='XF35mmF1.4 R', exif.exif&&exif.exif.lens);
  ok('EXIF settings composed', exif.exif && exif.exif.settings==='35mm · ƒ/1.4 · 1/500s · ISO 200', exif.exif&&exif.exif.settings);
  ok('EXIF date formatted', !!(exif.exif && /2026/.test(exif.exif.date)), exif.exif&&exif.exif.date);
  ok('meta.camera seeded from EXIF', exif.metaCamera==='FUJIFILM X-T5', exif.metaCamera);

  // Token replacement
  const tok = await page.evaluate(()=>{
    const S=window.PostcardPress; const card=S.currentCard();
    card.meta.title='Evening Light';
    S.state.global.photographer='Jane Doe';
    return {
      settings: S.applyTokens('Shot on {camera} — {settings}', card),
      mix: S.applyTokens('{title} by {photographer} · {lens}', card),
      empty: S.applyTokens('no braces here', card),
    };
  });
  ok('Token {camera}/{settings} replaced', tok.settings==='Shot on FUJIFILM X-T5 — 35mm · ƒ/1.4 · 1/500s · ISO 200', tok.settings);
  ok('Token {title}/{photographer}/{lens} replaced', tok.mix==='Evening Light by Jane Doe · XF35mmF1.4 R', tok.mix);

  // QR: enable, verify node-qrcode used + renders colored pixels; long-url capacity
  const qr = await page.evaluate(async ()=>{
    const S=window.PostcardPress; const card=S.currentCard();
    card.back.qrOn=true;
    // ensure element
    if(!card.back.elements.some(e=>e.type==='qr')) card.back.elements.push({id:'qr1',type:'qr',x:0.86,y:0.66,w:0.11,h:0.11,visible:true,qrDark:'#1a1a1a',qrLight:'#ffffff'});
    card.back.qrText='https://storitellah.com/postcards/evening-over-the-ridge?ref=demo&utm_source=card&utm_campaign=launch';
    const m = S.qrMatrix(card.back.qrText);
    // render back at 300dpi and sample the QR area for dark + light pixels
    const c = S.renderCardSide(card,'back',300,{bleed:false,export:true});
    const ctx=c.getContext('2d');
    // qr element rect in px (approx): x*tw*300..., just scan whole canvas for near-black clusters
    const {width,height}=c; const img=ctx.getImageData(0,0,width,height).data;
    let dark=0, light=0;
    for(let i=0;i<img.length;i+=4){ const r=img[i],g=img[i+1],b=img[i+2]; if(r<40&&g<40&&b<40)dark++; else if(r>230&&g>230&&b>230)light++; }
    return { size: m&&m.size, dark, light, w:width };
  });
  ok('QR uses node-qrcode matrix (long URL encodes)', qr.size>=25, `v-size ${qr.size}`);
  ok('QR renders dark modules on back', qr.dark>2000, `dark px ${qr.dark}`);

  // QR custom colors reflected
  const qrCol = await page.evaluate(async ()=>{
    const S=window.PostcardPress; const card=S.currentCard();
    const qe=card.back.elements.find(e=>e.type==='qr'); qe.qrDark='#b23a2f'; qe.qrLight='#fef8ef';
    const c=S.renderCardSide(card,'back',200,{export:true}); const ctx=c.getContext('2d');
    const img=ctx.getImageData(0,0,c.width,c.height).data; let red=0;
    for(let i=0;i<img.length;i+=4){ if(img[i]>150&&img[i]<200&&img[i+1]<90&&img[i+2]<80) red++; }
    return { red };
  });
  ok('QR dark color customizable', qrCol.red>500, `tinted px ${qrCol.red}`);

  // regenerate samples (front + a QR/EXIF back)
  await page.evaluate(async ()=>{
    const S=window.PostcardPress; await S.loadDemoProject();
  });
  await page.waitForTimeout(400);
  const saved = await page.evaluate(async ()=>{
    const S=window.PostcardPress;
    // add a QR + tokened caption to demo card 0 back for a richer sample
    const card=S.state.cards[0];
    card.back.qrOn=true;
    if(!card.back.elements.some(e=>e.type==='qr')) card.back.elements.push({id:'q',type:'qr',x:0.86,y:0.63,w:0.12,h:0.12,visible:true,qrDark:'#1a1a1a',qrLight:'#ffffff'});
    card.back.qrText='https://storitellah.com';
    card.back.elements.push({id:'tk',type:'text',bind:null,text:'{settings}',x:0.05,y:0.7,w:0.4,h:0.06,size:7,font:'mono',align:'left',color:'#8a8a86',visible:true,lineHeight:1.4,style:'normal',weight:'normal',letterSpacing:0});
    card.exif={camera:'FUJIFILM X-T5',lens:'XF35mmF1.4 R',settings:'35mm · ƒ/1.4 · 1/500s · ISO 200',date:'15 Mar 2026'};
    const front=S.renderCardSide(card,'front',300,{bleed:true,marks:true,export:true});
    const back=S.renderCardSide(card,'back',300,{bleed:true,marks:true,export:true});
    const toB64=async(cv)=>{const bytes=await S.canvasToBytes(cv,'jpg');let s='';const CH=0x8000;for(let i=0;i<bytes.length;i+=CH)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+CH));return btoa(s);};
    return { front: await toB64(front), back: await toB64(back) };
  });
  fs.writeFileSync(path.join(SAMPLES,'sample-front.jpg'), Buffer.from(saved.front,'base64'));
  fs.writeFileSync(path.join(SAMPLES,'sample-back.jpg'), Buffer.from(saved.back,'base64'));
  ok('Samples regenerated (front + QR/EXIF back)', true);

  ok('No console errors', errors.length===0, errors.slice(0,3).join(' | '));
  await browser.close(); server.close();
  const fails=results.filter(r=>!r.p);
  console.log(`\n${results.length-fails.length}/${results.length} checks passed`);
  process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
