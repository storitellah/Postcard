/* v2 redesign: on-card editing, layout gallery, snapping, mobile sheets,
   and regressions for the bugs fixed in this release. */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
const results = []; const ok = (n, p, x = '') => { results.push({ n, p }); console.log((p ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  — ' + x : '')); };

/* css position of a back element's centre / a front hit box */
const elCenter = (page, pred) => page.evaluate((src) => {
  const S = PostcardPress; const g = S.view._geom; const card = S.currentCard();
  const el = card.back.elements.find(new Function('return ' + src)());
  const it = g.content.items.find(i => i.side === 'back');
  const bl = S.state.bleedOn ? 0.125 : 0; const tw = 6, th = 4;
  const r = document.getElementById('previewViewport').getBoundingClientRect();
  return { x: r.left + g.ox + it.x * g.ppi + (bl + (el.x + el.w / 2) * tw) * g.ppi, y: r.top + g.oy + it.y * g.ppi + (bl + (el.y + el.h / 2) * th) * g.ppi, id: el.id };
}, pred.toString());
const frontHit = (page, key) => page.evaluate((k) => {
  const h = PostcardPress.view.hits.find(x => x.key === k); if (!h) return null;
  const r = document.getElementById('previewViewport').getBoundingClientRect();
  return { x: r.left + h.cx + h.cw / 2, y: r.top + h.cy + h.ch / 2 };
}, key);

(async () => {
  await new Promise(r => server.listen(8897, r));
  const b = await chromium.launch();
  const dctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await dctx.newPage();
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:8897/index.html'); await page.waitForTimeout(400);
  await page.click('#btnEmptyDemo');
  await page.waitForFunction(() => window.PostcardPress && PostcardPress.state.cards.length === 3, null, { timeout: 15000 });
  await page.waitForTimeout(600);

  /* layout gallery renders live canvases and applies on click */
  const tiles = await page.evaluate(() => ({ n: document.querySelectorAll('#tplGrid .tpl').length, canv: document.querySelectorAll('#tplGrid .tpl canvas').length }));
  ok('Layout gallery shows all front layouts as live previews', tiles.n === 15 && tiles.canv >= 10, JSON.stringify(tiles));
  await page.click('#tplGrid .tpl[data-id="split-diptych"]');
  await page.waitForTimeout(150);
  ok('Bug fix: diptych "second photo" control appears', await page.isVisible('#btnDiptychUpload'));
  ok('Gallery click applies the layout', await page.evaluate(() => PostcardPress.currentCard().front.style === 'split-diptych'));

  /* every new front layout renders for print without errors and without hint text */
  const hints = await page.evaluate(() => {
    const S = PostcardPress; const card = S.currentCard();
    S.state.global.photographer = ''; S.state.global.website = '';
    const out = { credit: S.bindTextReal(card, 'credit'), website: S.bindTextReal(card, 'website') };
    for (const p of S.FRONT_PRESETS) { S.applyFrontPreset(card.front, p.id); S.renderCardSide(card, 'front', 120, { export: true }); }
    return out;
  });
  ok('Bug fix: empty name/website print as nothing, not "Your Name"', hints.credit === '' && hints.website === '', JSON.stringify(hints));

  /* front: click text on the card, then type in place */
  await page.click('#tplGrid .tpl[data-id="caption-bar"]');
  await page.waitForTimeout(250);
  let h = await frontHit(page, 'title');
  ok('Front text has a clickable hit area', !!h);
  await page.mouse.dblclick(h.x, h.y);
  await page.waitForTimeout(150);
  ok('Double-click opens the on-card editor', await page.isVisible('#inlineEdit'));
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Salt and Light');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  ok('Typing on the card updates the title', await page.evaluate(() => PostcardPress.currentCard().meta.title === 'Salt and Light'));

  /* photo: drag pans only within the overflow */
  const ph = await frontHit(page, 'photo');
  await page.mouse.move(ph.x, ph.y); await page.mouse.down(); await page.mouse.move(ph.x + 900, ph.y + 600, { steps: 6 }); await page.mouse.up();
  const tx = await page.evaluate(() => PostcardPress.currentCard().front.tx);
  ok('Bug fix: photo drag is clamped to the picture edge', Math.abs(tx.x) <= 1 && Math.abs(tx.y) <= 1, JSON.stringify(tx));
  await page.waitForTimeout(120);
  const bar = await page.evaluate(() => ({ vis: !document.getElementById('ctxBar').hidden, txt: document.getElementById('ctxBar').textContent, fs: PostcardPress.frontSel, ed: !document.getElementById('inlineEdit').hidden }));
  ok('Selecting the photo shows its floating toolbar', bar.vis && /Replace/.test(bar.txt), JSON.stringify(bar));

  /* back: add a heading, type on it, snap it to the centre */
  await page.click('.rail-btn[data-panel="add"]');
  await page.click('[data-add="heading"]');
  await page.waitForTimeout(200);
  const added = await page.evaluate(() => { const S = PostcardPress; return { side: S.state.ui.side, sel: S.selectedEl && S.selectedEl.text }; });
  ok('Add → Heading lands on the back, selected', added.side === 'back' && added.sel === 'A heading', JSON.stringify(added));
  let c = await elCenter(page, (e) => e.text === 'A heading');
  await page.mouse.dblclick(c.x, c.y);
  await page.waitForTimeout(150);
  await page.keyboard.press('Control+A'); await page.keyboard.type('Dear Sam');
  await page.keyboard.press('Escape');
  ok('Back text edited in place', await page.evaluate((id) => PostcardPress.currentCard().back.elements.find(e => e.id === id).text === 'Dear Sam', c.id));
  c = await elCenter(page, (e) => e.text === 'Dear Sam');
  const target = await page.evaluate(() => { const g = PostcardPress.view._geom; const r = document.getElementById('previewViewport').getBoundingClientRect(); const it = g.content.items[0]; return r.left + g.ox + it.x * g.ppi + (0.125 + 3) * g.ppi; });
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(target + 3, c.y + 2, { steps: 8 });
  const snapping = await page.evaluate(() => !!(PostcardPress.view.snap && PostcardPress.view.snap.x.length));
  await page.mouse.up();
  const cx = await page.evaluate((id) => { const e = PostcardPress.currentCard().back.elements.find(x => x.id === id); return e.x + e.w / 2; }, c.id);
  ok('Dragging snaps to the card centre', snapping && Math.abs(cx - 0.5) < 0.006, `centre=${cx.toFixed(4)}`);
  await page.keyboard.press('Control+d');
  ok('Ctrl+D duplicates the selected element', await page.evaluate(() => PostcardPress.currentCard().back.elements.filter(e => e.text === 'Dear Sam').length === 2));

  /* new back layouts all render */
  const backs = await page.evaluate(() => { const S = PostcardPress; const card = S.currentCard(); const bad = []; for (const p of S.BACK_PRESETS) { S.applyBackPreset(card, p.id); const cv = S.renderCardSide(card, 'back', 100, { export: true }); if (cv.width < 100) bad.push(p.id); } return bad; });
  ok('All back layouts render', backs.length === 0, backs.join(','));

  /* QR placeholder never printed */
  const qrBlank = await page.evaluate(() => {
    const S = PostcardPress; const card = S.currentCard(); S.applyBackPreset(card, 'blank-mail');
    card.back.qrOn = true; card.back.qrText = ''; S.state.global.website = '';
    card.back.elements.push({ id: 'q', type: 'qr', x: 0.1, y: 0.1, w: 0.2, h: 0.2, visible: true });
    const cv = S.renderCardSide(card, 'back', 100, { export: true, bleed: false });
    const d = cv.getContext('2d').getImageData(Math.round(0.1 * 600), Math.round(0.1 * 400), 100, 60).data;
    let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) ink++;
    card.back.elements = card.back.elements.filter(e => e.id !== 'q'); card.back.qrOn = false;
    return ink;
  });
  ok('Bug fix: an empty QR box is not printed', qrBlank === 0, `ink px ${qrBlank}`);

  /* undo after delete brings the photo back */
  const und = await page.evaluate(async () => {
    const S = PostcardPress; const id = S.state.cards[1].imageId;
    S.deleteCard(1); S.undo();
    return { n: S.state.cards.length, has: S.imageStore.has(id), same: S.state.cards[1].imageId === id };
  });
  ok('Bug fix: undo after removing a card keeps its photo', und.n === 3 && und.has && und.same, JSON.stringify(und));

  /* contact sheet paginates instead of dropping cards */
  const contact = await page.evaluate(async () => {
    const S = PostcardPress; const base = S.state.cards.slice();
    while (S.state.cards.length < 20) S.state.cards.push(JSON.parse(JSON.stringify(base[S.state.cards.length % 3])));
    const blob = await S.buildContactPdf(S.state.cards, 'a4');
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    S.state.cards.length = 3;
    return (s.match(/\/Type \/Page[^s]/g) || []).length;
  });
  ok('Bug fix: contact sheet pages hold every card (20 cards → 2 pages)', contact === 2, `pages=${contact}`);

  /* print uses true physical size */
  const pr = await page.evaluate(async () => {
    window.print = () => {};
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    await PostcardPress.printCanvasesForTest(c);
    const img = document.querySelector('.print-root img');
    return img && img.style.width;
  });
  ok('Bug fix: print pages are true size (6in wide card)', pr === '6in', String(pr));

  /* export dialog */
  await page.click('#btnExportOpen');
  ok('Export opens a dialog with a plain-language summary', await page.isVisible('#dlgExport') && /You'll get/.test(await page.textContent('#expSummary')));
  await page.click('#dlgExport [data-close]');

  /* autosave v2 round trip */
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
  const p2 = await page.context().newPage();
  await p2.goto('http://localhost:8897/index.html');
  await p2.waitForFunction(() => window.PostcardPress && PostcardPress.state.cards.length === 3, null, { timeout: 8000 }).catch(() => {});
  const restored = await p2.evaluate(() => PostcardPress.state.cards.length === 3 && PostcardPress.state.cards.every(c => PostcardPress.imageStore.has(c.imageId)));
  ok('Autosave restores cards and photos after reload', restored);
  await p2.close();

  ok('No console errors (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '));

  /* ── phone ── */
  const ctx = await b.newContext(devices['iPhone 13']);
  const m = await ctx.newPage();
  const merr = []; m.on('pageerror', e => merr.push(String(e)));
  await m.goto('http://localhost:8897/index.html');
  await m.waitForTimeout(300);
  await m.tap('#btnEmptyDemo');
  await m.waitForFunction(() => window.PostcardPress && PostcardPress.state.cards.length === 3, null, { timeout: 8000 });
  await m.waitForTimeout(400);
  ok('Phone: tab bar visible, no panel covering the card at start', await m.isVisible('.rail-btn[data-panel="templates"]') && !(await m.isVisible('#drawer')));
  const before = await m.evaluate(() => document.getElementById('previewViewport').clientHeight);
  await m.tap('.rail-btn[data-panel="templates"]');
  await m.waitForTimeout(300);
  const after = await m.evaluate(() => document.getElementById('previewViewport').clientHeight);
  ok('Phone: Layouts opens as a sheet and the card stays visible above it', await m.isVisible('#tplGrid') && after > 150 && after < before, `${before}→${after}`);
  await m.tap('.rail-btn[data-panel="templates"]');
  await m.waitForTimeout(200);
  ok('Phone: tapping the tab again closes the sheet', !(await m.isVisible('#drawer')));
  const vp = await m.evaluate(() => { const r = document.getElementById('previewViewport').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40 }; });
  const cdp = await ctx.newCDPSession(m);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', vp.x + 120, vp.y); for (let i = 1; i <= 6; i++) await touch('touchMove', vp.x + 120 - i * 40, vp.y); await touch('touchEnd');
  await m.waitForTimeout(200);
  ok('Bug fix: swipe flips the card on phones', await m.evaluate(() => PostcardPress.state.ui.side === 'back'));
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  ok('Phone: no horizontal overflow', overflow);
  ok('No console errors (phone)', merr.length === 0, merr.slice(0, 2).join(' | '));
  await ctx.close();

  await b.close(); server.close();
  const fails = results.filter(r => !r.p);
  console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
