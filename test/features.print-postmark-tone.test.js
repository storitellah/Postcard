const { chromium } = require('playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Postcard', SAMPLES=path.join(ROOT,'samples');
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
  await page.waitForTimeout(300);

  // STEP 3: guides excluded from export (toggle guides -> identical export bytes)
  const g = await page.evaluate(async ()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    S.state.ui.guides=true;  const a=S.renderCardSide(card,'front',150,{bleed:true,marks:false,export:true}).toDataURL('image/png');
    S.state.ui.guides=false; const c=S.renderCardSide(card,'front',150,{bleed:true,marks:false,export:true}).toDataURL('image/png');
    return { same: a===c };
  });
  ok('Guides never appear in exports', g.same);

  // STEP 5: aspect crop letterboxes with border color (65:24 on a 4x6 landscape -> top/bottom border bands)
  const crop = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    card.front.layout='full-bleed'; card.front.borderW=0; card.front.borderBottom=0; card.front.borderColor='#ffffff'; card.front.cropAspect=65/24;
    const c=S.renderCardSide(card,'front',150,{bleed:false,export:true}); const ctx=c.getContext('2d');
    // sample a top-center pixel (should be white letterbox) vs center (photo)
    const top=ctx.getImageData(c.width/2,4,1,1).data;
    const mid=ctx.getImageData(c.width/2,c.height/2,1,1).data;
    return { topWhite: top[0]>245&&top[1]>245&&top[2]>245, midPhoto: !(mid[0]>245&&mid[1]>245&&mid[2]>245) };
  });
  ok('Aspect crop letterboxes (XPan 65:24)', crop.topWhite && crop.midPhoto);

  // STEP 5: B&W renders near-grayscale; warm tint warms channels
  const tone = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    card.front.cropAspect=null; card.front.fit='fill';
    card.front.adjust={mode:'bw',exposure:1,contrast:1};
    const bw=S.renderCardSide(card,'front',120,{export:true}); let gray=0,tot=0; { const d=bw.getContext('2d').getImageData(0,0,bw.width,bw.height).data; for(let i=0;i<d.length;i+=400){tot++; if(Math.abs(d[i]-d[i+1])<6&&Math.abs(d[i+1]-d[i+2])<6)gray++; } }
    card.front.adjust={mode:'warm',exposure:1,contrast:1};
    const warm=S.renderCardSide(card,'front',120,{export:true}); let rSum=0,bSum=0,c=0; { const d=warm.getContext('2d').getImageData(0,0,warm.width,warm.height).data; for(let i=0;i<d.length;i+=400){rSum+=d[i];bSum+=d[i+2];c++;} }
    card.front.adjust={mode:'none',exposure:1,contrast:1};
    return { grayFrac: gray/tot, warmR: rSum/c, warmB: bSum/c, filterBW: S.adjustFilter({mode:'bw',exposure:1,contrast:1}), filterWarm: S.adjustTint({mode:'warm'}) };
  });
  ok('B&W look renders near-grayscale', tone.grayFrac>0.9, `gray ${(tone.grayFrac*100).toFixed(0)}%`);
  ok('Warm tint warms (R>B)', tone.warmR>tone.warmB, `R${tone.warmR|0} B${tone.warmB|0}`);
  ok('adjustFilter builds grayscale', /grayscale/.test(tone.filterBW), tone.filterBW);

  // STEP 4: postmark
  const pm = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    const el=S.ensurePostmark(card); el.ink='#9e4038'; el.city='NAIROBI'; el.date='15 MAR 2026'; el.blend='normal'; el.opacity=1;
    el.x=0.5; el.y=0.3; el.w=0.42; el.h=0.2;
    const c=S.renderCardSide(card,'back',200,{export:true}); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let red=0; for(let i=0;i<d.length;i+=4){ if(d[i]>120&&d[i]<190&&d[i+1]<100&&d[i+2]<100)red++; }
    return { red, hasEl: !!S.postmarkElement(card) };
  });
  ok('Postmark element created', pm.hasEl);
  ok('Postmark renders red ink strokes', pm.red>300, `ink px ${pm.red}`);

  // STEP 4: vintage stamp renders (stamp box not blank white)
  const stamp = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    let st=S.stampElement(card); st.stampStyle='vintage';
    const c=S.renderCardSide(card,'back',200,{export:true}); const ctx=c.getContext('2d');
    // stamp rect approx (x .855, y .055, w .115, h .24) of trim 6x4 (landscape) w/o bleed
    // scan the stamp rect (x .855..~.97, y .055..~.30 of the trim area) for non-white (cream body + frame)
    const sx=Math.round(0.86*c.width), sy=Math.round(0.06*c.height), sw=Math.round(0.11*c.width), sh=Math.round(0.22*c.height);
    const d=ctx.getImageData(sx,sy,sw,sh).data; let ink=0; for(let i=0;i<d.length;i+=4){ if(d[i]<250||d[i+1]<250||d[i+2]<245)ink++; }
    return { ink };
  });
  ok('Vintage stamp draws a frame', stamp.ink>20, `ink px ${stamp.ink}`);

  // STEP 6: .postcard round-trip preserves new fields
  const rt = await page.evaluate(async ()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    card.front.cropAspect=3/2; card.front.adjust={mode:'cool',exposure:1.1,contrast:1.2};
    S.ensurePostmark(card); 
    const json=JSON.stringify(S.serializeProject());
    // restore via File through the public path
    const file=new File([json],'demo.postcard',{type:'application/json'});
    await S.restoreProjectFile(file);
    const c2=S.state.cards[0];
    return { crop:c2.front.cropAspect, mode:c2.front.adjust.mode, exp:c2.front.adjust.exposure, pm: !!S.postmarkElement(c2) };
  });
  ok('.postcard restore keeps crop+adjust+postmark', Math.abs(rt.crop-1.5)<1e-9 && rt.mode==='cool' && Math.abs(rt.exp-1.1)<1e-9 && rt.pm, `crop=${rt.crop} mode=${rt.mode} pm=${rt.pm}`);

  // Regenerate a showcase back sample: vintage stamp + red postmark + QR
  const saved = await page.evaluate(async ()=>{
    const S=PostcardPress; await S.loadDemoProject(); const card=S.state.cards[0];
    card.meta.location='Rift Valley'; card.meta.date='15 Mar 2026';
    card.exif={camera:'FUJIFILM X-T5',lens:'XF35mmF1.4 R',settings:'35mm · ƒ/1.4 · 1/500s · ISO 200',date:'15 Mar 2026'};
    let st=S.stampElement(card); st.stampStyle='vintage';
    const pm=S.ensurePostmark(card); pm.ink='#9e4038'; pm.city='Rift Valley'; pm.date='15 MAR 2026'; pm.x=0.5; pm.y=0.04; pm.w=0.46; pm.h=0.2; pm.blend='multiply'; pm.opacity=0.9;
    card.back.qrOn=true; if(!S.postmarkElement(card)) {} 
    if(!card.back.elements.some(e=>e.type==='qr')) card.back.elements.push({id:'q',type:'qr',x:0.86,y:0.64,w:0.12,h:0.12,visible:true,qrDark:'#1a1a1a',qrLight:'#ffffff'});
    card.back.qrText='https://storitellah.com';
    card.back.elements.push({id:'tk',type:'text',bind:null,text:'{settings}',x:0.05,y:0.7,w:0.4,h:0.06,size:7,font:'mono',align:'left',color:'#8a8a86',visible:true,lineHeight:1.4,style:'normal',weight:'normal',letterSpacing:0});
    const back=S.renderCardSide(card,'back',300,{bleed:true,marks:true,export:true});
    // front: panoramic B&W showcase on card 2
    const card2=S.state.cards[1]; card2.front.adjust={mode:'bwhc',exposure:1,contrast:1}; card2.front.cropAspect=null;
    const front=S.renderCardSide(card2,'front',300,{bleed:true,marks:true,export:true});
    const toB64=async(cv)=>{const by=await S.canvasToBytes(cv,'jpg');let s='';for(let i=0;i<by.length;i+=0x8000)s+=String.fromCharCode.apply(null,by.subarray(i,i+0x8000));return btoa(s);};
    return { back: await toB64(back), front: await toB64(front) };
  });
  fs.writeFileSync(path.join(SAMPLES,'sample-back.jpg'), Buffer.from(saved.back,'base64'));
  fs.writeFileSync(path.join(SAMPLES,'sample-front-bw.jpg'), Buffer.from(saved.front,'base64'));
  ok('Showcase samples regenerated', true);

  ok('No console errors', errors.length===0, errors.slice(0,3).join(' | '));
  await b.close(); server.close();
  const fails=results.filter(r=>!r.p);
  console.log(`\n${results.length-fails.length}/${results.length} checks passed`);
  process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
