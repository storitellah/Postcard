const { chromium } = require('playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/Postcard', SAMPLES=path.join(ROOT,'samples');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{let p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(p)]||'x'});res.end(d);});});
const results=[]; const ok=(n,p,x='')=>{results.push({n,p});console.log((p?'PASS':'FAIL')+'  '+n+(x?'  — '+x:''));};
const nonBlank=(cv)=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let nz=0;for(let i=0;i<d.length;i+=40){if(d[i]<248||d[i+1]<248||d[i+2]<248)nz++;}return nz;};
(async()=>{
  await new Promise(r=>server.listen(8899,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const page=await b.newPage({viewport:{width:1440,height:900}});
  const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://localhost:8899/index.html'); await page.waitForTimeout(500);

  // registries
  const reg = await page.evaluate(()=>{
    const S=PostcardPress;
    const valid=(arr,cat)=>arr.every(p=>p.id&&p.name&&p.category===cat&&typeof p.thumbnailSvg==='string'&&/<svg/.test(p.thumbnailSvg));
    return { fN:S.FRONT_PRESETS.length, bN:S.BACK_PRESETS.length, fOk:valid(S.FRONT_PRESETS,'front'), bOk:valid(S.BACK_PRESETS,'back'),
             fIds:S.FRONT_PRESETS.map(p=>p.id), bIds:S.BACK_PRESETS.map(p=>p.id) };
  });
  ok('Front registry: 6 archetypes + custom, valid schema', reg.fN===7 && reg.fOk, reg.fIds.join(','));
  ok('Back registry: 5 archetypes, valid schema', reg.bN===5 && reg.bOk, reg.bIds.join(','));

  await page.click('#btnEmptyDemo');
  await page.waitForFunction(()=>window.PostcardPress&&PostcardPress.state.cards.length===3,null,{timeout:15000});
  await page.waitForTimeout(300);

  // every FRONT preset applies + renders without error
  const frontRender = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0]; const out={};
    for(const p of S.FRONT_PRESETS){ S.applyFrontPreset(card.front,p.id); const c=S.renderCardSide(card,'front',150,{export:true});
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let nz=0; for(let i=0;i<d.length;i+=40){if(d[i]<248||d[i+1]<248||d[i+2]<248)nz++;}
      out[p.id]={nz, style:card.front.style}; }
    return out;
  });
  ok('All 6+1 front presets apply & render', Object.values(frontRender).every(v=>v.nz>200), Object.keys(frontRender).map(k=>k+':'+frontRender[k].nz).join(' '));

  // diptych with 2nd photo draws both panes
  const dip = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    S.applyFrontPreset(card.front,'split-diptych');
    card.imageId2 = S.state.cards[2].imageId;  // reuse another demo photo
    const c=S.renderCardSide(card,'front',150,{export:true}); const ctx=c.getContext('2d');
    const L=ctx.getImageData(Math.round(c.width*0.25),Math.round(c.height*0.45),1,1).data;
    const R=ctx.getImageData(Math.round(c.width*0.75),Math.round(c.height*0.45),1,1).data;
    // the centre column is the border-colour gap (divider)
    const G=ctx.getImageData(Math.round(c.width*0.5),Math.round(c.height*0.45),1,1).data;
    const notBorder=(p)=>!(p[0]>245&&p[1]>245&&p[2]>245);
    const isBorder=(p)=>p[0]>245&&p[1]>245&&p[2]>245;
    return { left:notBorder(L), right:notBorder(R), gap:isBorder(G), diff: Math.abs(L[0]-R[0])+Math.abs(L[1]-R[1])+Math.abs(L[2]-R[2]) };
  });
  ok('Diptych draws two panes split by a divider', dip.left && dip.right && dip.gap && dip.diff>20, `diff=${dip.diff} gap=${dip.gap}`);

  // every BACK preset applies + renders
  const backRender = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0]; const out={};
    for(const p of S.BACK_PRESETS){ S.applyBackPreset(card,p.id); const c=S.renderCardSide(card,'back',150,{export:true});
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let nz=0; for(let i=0;i<d.length;i+=40){if(d[i]<248||d[i+1]<248||d[i+2]<248)nz++;}
      out[p.id]={nz, els:card.back.elements.length}; }
    return out;
  });
  ok('All 5 back presets apply & render', Object.values(backRender).every(v=>v.nz>200 && v.els>=4), Object.keys(backRender).map(k=>k+':'+backRender[k].els).join(' '));

  // airmail draws red AND blue chevrons
  const air = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0]; S.applyBackPreset(card,'airmail');
    const c=S.renderCardSide(card,'back',200,{export:true}); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let red=0,blue=0; for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2]; if(r>150&&g<90&&b<80)red++; else if(b>110&&r<90&&g<110)blue++;}
    return { red, blue };
  });
  ok('Airmail border draws red + blue chevrons', air.red>200 && air.blue>200, `red ${air.red} blue ${air.blue}`);

  // field-note EXIF table renders text (give card exif)
  const fn = await page.evaluate(()=>{
    const S=PostcardPress; const card=S.state.cards[0];
    card.exif={camera:'FUJIFILM X-T5',lens:'XF35mmF1.4 R',settings:'35mm · ƒ/1.4 · 1/500s · ISO 200',date:'15 Mar 2026'};
    S.applyBackPreset(card,'field-note');
    const c=S.renderCardSide(card,'back',200,{export:true}); const d=c.getContext('2d').getImageData(Math.round(c.width*0.57),Math.round(c.height*0.06),Math.round(c.width*0.38),Math.round(c.height*0.28)).data;
    let ink=0; for(let i=0;i<d.length;i+=4){ if(d[i]<120&&d[i+1]<120&&d[i+2]<120)ink++; }
    return { ink };
  });
  ok('Field Note EXIF table renders', fn.ink>100, `ink ${fn.ink}`);

  // backward-compat: legacy card (front.layout only, legacy back layout) normalizes + renders
  const legacy = await page.evaluate(()=>{
    const S=PostcardPress;
    // craft a legacy-style project archive
    const proj = S.serializeProject();
    const c0 = proj.state.cards[0];
    delete c0.front.style; delete c0.front.matHairline; delete c0.front.captionStyle; delete c0.front.overlayCorners;
    c0.front.layout='museum';           // legacy id
    c0.back.layout='story';             // legacy id (elements already present)
    delete c0.imageId2;
    return { before: c0.front.style };
  });
  const legacyLoad = await page.evaluate(async ()=>{
    const S=PostcardPress; const proj=S.serializeProject();
    proj.state.cards[0].front.layout='museum'; delete proj.state.cards[0].front.style;
    await S.loadProjectData(proj);
    const f=S.state.cards[0].front;
    const c=S.renderCardSide(S.state.cards[0],'front',120,{export:true});
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let nz=0; for(let i=0;i<d.length;i+=40){if(d[i]<248)nz++;}
    return { style:f.style, hasFields: f.captionStyle!==undefined && f.matHairline!==undefined, nz };
  });
  ok('Legacy project normalizes (layout→style) & renders', legacyLoad.style && legacyLoad.hasFields && legacyLoad.nz>200, `style=${legacyLoad.style}`);

  // .postcard round-trip preserves preset style + imageId2
  const rt = await page.evaluate(async ()=>{
    const S=PostcardPress; await S.loadDemoProject(); const card=S.state.cards[0];
    S.applyFrontPreset(card.front,'fineart-mat'); card.imageId2=S.state.cards[1].imageId; S.applyBackPreset(card,'direct-mailer');
    const json=JSON.stringify(S.serializeProject());
    await S.restoreProjectFile(new File([json],'p.postcard',{type:'application/json'}));
    const c2=S.state.cards[0];
    return { style:c2.front.style, mat:c2.front.matHairline, im2:!!c2.imageId2, back:c2.back.layout };
  });
  ok('.postcard preserves front style + diptych + back preset', rt.style==='fineart-mat' && rt.mat===true && rt.im2 && rt.back==='direct-mailer', JSON.stringify(rt));

  // regenerate a showcase: front presets contact-style board + a couple sample fronts/backs
  const saved = await page.evaluate(async ()=>{
    const S=PostcardPress; await S.loadDemoProject();
    const toB64=async(cv)=>{const by=await S.canvasToBytes(cv,'jpg');let s='';for(let i=0;i<by.length;i+=0x8000)s+=String.fromCharCode.apply(null,by.subarray(i,i+0x8000));return btoa(s);};
    // diptych front on card0 using card1 as 2nd
    const c0=S.state.cards[0]; S.applyFrontPreset(c0.front,'split-diptych'); c0.imageId2=S.state.cards[1].imageId; c0.meta.caption='Before / After';
    const dip=await toB64(S.renderCardSide(c0,'front',300,{bleed:true,marks:true,export:true}));
    // airmail back on card0
    const c1=S.state.cards[2]; c1.meta.location='Amboseli'; c1.meta.date='15 JUN 2026';
    S.applyBackPreset(c1,'airmail');
    const airmail=await toB64(S.renderCardSide(c1,'back',300,{bleed:true,marks:true,export:true}));
    return { dip, airmail };
  });
  fs.writeFileSync(path.join(SAMPLES,'sample-diptych-front.jpg'), Buffer.from(saved.dip,'base64'));
  fs.writeFileSync(path.join(SAMPLES,'sample-airmail-back.jpg'), Buffer.from(saved.airmail,'base64'));
  ok('Showcase samples regenerated', true);

  ok('No console errors', errors.length===0, errors.slice(0,3).join(' | '));
  await b.close(); server.close();
  const fails=results.filter(r=>!r.p);
  console.log(`\n${results.length-fails.length}/${results.length} checks passed`);
  process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
