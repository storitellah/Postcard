/* ═══════════════════════════════════════════════════════════════
   Postcard Press by Storitellah — script.js
   Local-first postcard design studio.
   No frameworks · no tracking · everything stays on your device.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ───────────────────────── Constants ───────────────────────── */
const DPI = 300;                    // export resolution
const PT = 1 / 72;                  // 1 point in inches
const MM = 1 / 25.4;                // 1 mm in inches
const BLEED_IN = 0.125;             // standard bleed
const SAFE_IN = 0.1875;             // safe margin from trim
const MARK_LEN = 0.16;              // crop mark length (in)
const MARK_GAP = 0.04;              // crop mark offset from bleed edge

const SIZE_PRESETS = [
  { id: '4x6',     label: '4 × 6 in (standard)',   w: 6,          h: 4 },
  { id: '5x7',     label: '5 × 7 in',              w: 7,          h: 5 },
  { id: 'a6',      label: 'A6 (105 × 148 mm)',     w: 148 * MM,   h: 105 * MM },
  { id: '105x148', label: '105 × 148 mm',          w: 148 * MM,   h: 105 * MM },
  { id: '100x150', label: '100 × 150 mm',          w: 150 * MM,   h: 100 * MM },
  { id: '127x178', label: '127 × 178 mm',          w: 178 * MM,   h: 127 * MM },
  { id: 'us',      label: 'US Postcard (4¼ × 6)',  w: 6,          h: 4.25 },
  { id: 'square',  label: 'Square (5 × 5 in)',     w: 5,          h: 5 },
  { id: 'custom',  label: 'Custom size…',          w: 6,          h: 4 },
];

const FONTS = {
  sans:      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  serif:     '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  mono:      '"Courier New", ui-monospace, "SF Mono", Consolas, Menlo, monospace',
  script:    '"Snell Roundhand", "Segoe Script", "Bradley Hand", "Brush Script MT", "Comic Sans MS", cursive',
  /* self-hosted (fonts/), so the same everywhere */
  editorial: '"Instrument Serif", "Iowan Old Style", Georgia, serif',
  display:   'Anton, Impact, "Haettenschweiler", "Arial Narrow Bold", "Arial Black", sans-serif',
};
/* Load a vendored script only when it is first needed (keeps first load light). */
const scriptLoads = {};
function loadScript(src) {
  if (!scriptLoads[src]) {
    scriptLoads[src] = new Promise((res) => {
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = () => res(true);
      el.onerror = () => res(false);   /* app degrades gracefully without it */
      document.head.appendChild(el);
    });
  }
  return scriptLoads[src];
}
const loadQrLib = () => (typeof QRCode !== 'undefined' ? Promise.resolve(true) : loadScript('vendor/qrcode.bundle.js'));
const loadExifLib = () => (typeof exifr !== 'undefined' ? Promise.resolve(true) : loadScript('vendor/exifr.lite.umd.js'));

/* make sure the self-hosted faces (and the QR encoder, if any card uses a QR)
   are ready before a canvas is rendered for a file */
let fontsReady = null;
function ensureFonts() {
  const qr = (typeof state !== 'undefined' && state.cards.some(c => c.back.elements.some(e => e.type === 'qr' && e.visible))) ? loadQrLib() : null;
  if (!fontsReady) {
    fontsReady = (!document.fonts || !document.fonts.load) ? Promise.resolve() : Promise.all([
      document.fonts.load('40px "Instrument Serif"'),
      document.fonts.load('italic 40px "Instrument Serif"'),
      document.fonts.load('40px Anton'),
    ]).catch(() => {});
  }
  return qr ? Promise.all([fontsReady, qr]) : fontsReady;
}


/* ═══════════════════════ Preset registries ═══════════════════════
   Declarative CardPreset objects (see README / feature spec). Front presets
   parameterise the front renderer via `front`; back presets declare an
   `elements` template that is instantiated into draggable back elements.
   thumbnailSvg is a lightweight inline vector preview (uses currentColor). */
const T = (v) => `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.4">${v}</svg>`;

const FRONT_PRESETS = [
  {
    id: 'classic-gallery', tag: 'Thin white border, centred caption', name: 'Classic Gallery', category: 'front',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".08"/><rect x="5" y="5" width="30" height="14" fill="currentColor" opacity=".5"/><line x1="13" y1="22.5" x2="27" y2="22.5" stroke-width="1.6"/>'),
    front: { style: 'gallery', borderW: 0.2, borderBottom: 0, borderColor: '#ffffff', fit: 'fill',
      matHairline: true, captionStyle: 'serif', creditPlace: 'center', creditFormat: 'photo',
      show: { title: false, caption: true, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'museum-broadsheet', tag: 'Framed photo over a museum label', name: 'Museum Broadsheet', category: 'front',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".08"/><rect x="4.5" y="4.5" width="31" height="13" fill="currentColor" opacity=".5"/><line x1="4.5" y1="20" x2="22" y2="20" stroke-width="2.2"/><line x1="4.5" y1="23" x2="30" y2="23" stroke-width="1"/>'),
    front: { style: 'broadsheet', borderW: 0.22, borderBottom: 0.95, borderColor: '#fbfaf7', fit: 'fill',
      matHairline: false, captionStyle: 'sans', creditPlace: 'hidden', creditFormat: 'photo',
      show: { title: true, caption: true, website: false, project: true, copyright: false, logo: false } },
  },
  {
    id: 'fullbleed-modern', tag: 'Edge to edge, type in the corners', name: 'Full-Bleed Modern', category: 'front',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".5"/><rect x="4" y="19" width="14" height="4.5" fill="#fff" opacity=".85"/><rect x="26" y="19" width="10" height="3" fill="#fff" opacity=".7"/>'),
    front: { style: 'modern', borderW: 0, borderBottom: 0, borderColor: '#101216', fit: 'fill',
      matHairline: false, captionStyle: 'sans', overlayCorners: true, creditPlace: 'bottom-right', creditFormat: 'photo',
      show: { title: true, caption: false, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'split-diptych', tag: 'Two photos side by side', name: 'Split Diptych', category: 'front',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".08"/><rect x="4.5" y="4.5" width="14.5" height="15" fill="currentColor" opacity=".5"/><rect x="21" y="4.5" width="14.5" height="15" fill="currentColor" opacity=".35"/><line x1="20" y1="4.5" x2="20" y2="19.5"/><line x1="12" y1="23" x2="28" y2="23" stroke-width="1"/>'),
    front: { style: 'diptych', borderW: 0.14, borderBottom: 0.34, borderColor: '#ffffff', fit: 'fill',
      matHairline: false, captionStyle: 'sans', creditPlace: 'center', creditFormat: 'photo',
      show: { title: false, caption: false, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'vintage-polaroid', tag: 'Instant-film border with a note', name: 'Vintage Polaroid', category: 'front',
    thumbnailSvg: T('<rect x="4.5" y="2.5" width="31" height="23" rx="1" fill="#fff" stroke="currentColor" opacity=".9"/><rect x="7" y="4.5" width="26" height="14" fill="currentColor" opacity=".5"/><path d="M10 22h13" stroke-width="1.2" opacity=".7"/>'),
    front: { style: 'polaroid', borderW: 0.16, borderBottom: 0.9, borderColor: '#fffdf6', fit: 'fill',
      matHairline: false, captionStyle: 'script', creditPlace: 'hidden', creditFormat: 'photo',
      show: { title: false, caption: true, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'fineart-mat', tag: 'Floating photo on an ivory mat', name: 'Fine-Art Mat', category: 'front',
    thumbnailSvg: T('<rect x="1.5" y="1.5" width="37" height="25" rx="1.5" fill="currentColor" opacity=".06"/><rect x="8" y="6" width="24" height="12" fill="currentColor" opacity=".5"/><rect x="7" y="5" width="26" height="14" stroke-width="0.6" opacity=".6"/><line x1="14" y1="22.5" x2="26" y2="22.5" stroke-width="1"/>'),
    front: { style: 'mat', borderW: 0.45, borderBottom: 0.1, borderColor: '#f4efe3', fit: 'fit',
      matHairline: true, captionStyle: 'serif', creditPlace: 'center', creditFormat: 'photo',
      show: { title: true, caption: false, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'night-gallery', name: 'Night Gallery', category: 'front', tag: 'Black mat, white type',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".85"/><rect x="6" y="5" width="28" height="12" fill="#fff" opacity=".55"/><line x1="13" y1="21" x2="27" y2="21" stroke="#fff" stroke-width="1.4"/>'),
    front: { style: 'gallery', borderW: 0.22, borderBottom: 0.56, borderColor: '#121212', fit: 'fill',
      matHairline: false, captionStyle: 'serif', creditPlace: 'center', creditFormat: 'photo',
      show: { title: true, caption: true, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'greetings', name: 'Greetings From', category: 'front', tag: 'Big letters filled with your photo',
    usesAccent: true, accents: ['#e8b931', '#d9502e', '#2f6f8f', '#f2efe6', '#1c1a17'],
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".25"/><text x="20" y="20" font-size="12" font-weight="900" text-anchor="middle" fill="currentColor" stroke="none">ABC</text>'),
    front: { style: 'greetings', borderW: 0, borderBottom: 0, borderColor: '#1c1a17', accent: '#e8b931', fit: 'fill',
      matHairline: false, captionStyle: 'script', creditPlace: 'bottom-right', creditFormat: 'photo', tagline: 'Greetings from',
      show: { title: false, caption: false, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'travel-poster', name: 'Travel Poster', category: 'front', tag: 'Photo over a bold title band',
    usesAccent: true, accents: ['#1f4e5f', '#b5442e', '#1c1a17', '#2d5a3d', '#e3a72f'],
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".7"/><rect x="5" y="5" width="30" height="12" fill="#fff" opacity=".6"/><rect x="5" y="19" width="16" height="3.5" fill="#fff"/>'),
    front: { style: 'travel-poster', borderW: 0.16, borderBottom: 0, borderColor: '#1f4e5f', accent: '#1f4e5f', fit: 'fill',
      matHairline: false, captionStyle: 'sans', creditPlace: 'hidden', creditFormat: 'photo',
      show: { title: true, caption: true, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'film-strip', name: '35mm Frame', category: 'front', tag: 'Sprocket holes and edge print',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1" fill="currentColor"/><g fill="#fff" opacity=".8"><rect x="5" y="4" width="2.4" height="2"/><rect x="10" y="4" width="2.4" height="2"/><rect x="15" y="4" width="2.4" height="2"/><rect x="20" y="4" width="2.4" height="2"/><rect x="25" y="4" width="2.4" height="2"/><rect x="30" y="4" width="2.4" height="2"/><rect x="5" y="22" width="2.4" height="2"/><rect x="10" y="22" width="2.4" height="2"/><rect x="15" y="22" width="2.4" height="2"/><rect x="20" y="22" width="2.4" height="2"/><rect x="25" y="22" width="2.4" height="2"/><rect x="30" y="22" width="2.4" height="2"/></g><rect x="4" y="8" width="32" height="12" fill="#fff" opacity=".55"/>'),
    front: { style: 'film-strip', borderW: 0, borderBottom: 0, borderColor: '#0d0d0d', fit: 'fill',
      matHairline: false, captionStyle: 'mono', creditPlace: 'hidden', creditFormat: 'photo',
      show: { title: true, caption: false, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'postage-stamp', name: 'Postage Stamp', category: 'front', tag: 'Your photo as a giant stamp',
    usesAccent: true, accents: ['#e9e3d6', '#2a4d8f', '#c23b22', '#2d5a3d', '#1c1a17'],
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".15"/><rect x="9" y="5" width="22" height="18" fill="#fff" stroke-dasharray="1.3 1"/><rect x="11.5" y="7.5" width="17" height="11" fill="currentColor" opacity=".55"/>'),
    front: { style: 'postage-stamp', borderW: 0, borderBottom: 0, borderColor: '#e9e3d6', accent: '#e9e3d6', fit: 'fill',
      matHairline: false, captionStyle: 'sans', creditPlace: 'hidden', creditFormat: 'photo', cancel: true,
      show: { title: false, caption: false, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'caption-bar', name: 'Caption Bar', category: 'front', tag: 'Full bleed with a solid name band',
    usesAccent: true, accents: ['#151515', '#f4f1ea', '#c23b22', '#1f4e5f', '#5b4636'],
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".5"/><rect x="2.5" y="19.5" width="35" height="6" fill="currentColor"/><line x1="5" y1="22.5" x2="17" y2="22.5" stroke="#fff" stroke-width="1.4"/>'),
    front: { style: 'caption-bar', borderW: 0, borderBottom: 0, borderColor: '#151515', accent: '#151515', fit: 'fill',
      matHairline: false, captionStyle: 'serif', creditPlace: 'hidden', creditFormat: 'photo',
      show: { title: true, caption: false, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'editorial-cover', name: 'Editorial', category: 'front', tag: 'Magazine-style headline and photo',
    usesAccent: true, accents: ['#f4efe4', '#ffffff', '#1c1a17', '#e6d9c3', '#c9d6d2'],
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".06"/><line x1="5" y1="7" x2="15" y2="7" stroke-width="2.4"/><line x1="5" y1="11" x2="13" y2="11" stroke-width="2.4"/><rect x="18" y="5" width="17" height="18" fill="currentColor" opacity=".5"/><line x1="5" y1="21" x2="13" y2="21" stroke-width=".8"/>'),
    front: { style: 'editorial-cover', borderW: 0.2, borderBottom: 0, borderColor: '#f4efe4', accent: '#f4efe4', fit: 'fill',
      matHairline: false, captionStyle: 'serif', creditPlace: 'hidden', creditFormat: 'photo',
      show: { title: true, caption: true, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'headline', name: 'Big Greeting', category: 'front', tag: 'Large words across the middle',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".5"/><line x1="9" y1="13" x2="31" y2="13" stroke="#fff" stroke-width="2.6"/><line x1="14" y1="17.5" x2="26" y2="17.5" stroke="#fff" stroke-width=".9"/>'),
    front: { style: 'headline', borderW: 0, borderBottom: 0, borderColor: '#111111', fit: 'fill',
      matHairline: false, captionStyle: 'serif', creditPlace: 'bottom-right', creditFormat: 'photo',
      show: { title: true, caption: true, website: false, project: false, copyright: false, logo: false } },
  },
  {
    id: 'custom', name: 'Custom', category: 'front', tag: 'Your own border settings',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".08"/><path d="M20 8v12M14 14h12" stroke-width="1.6" opacity=".6"/>'),
    front: null,   /* keeps current front values */
  },
];

/* legacy front layout id → new preset id (for old projects) */
const FRONT_LAYOUT_ALIAS = {
  'full-bleed': 'fullbleed-modern', gallery: 'classic-gallery', editorial: 'museum-broadsheet',
  minimal: 'classic-gallery', 'wide-bottom': 'museum-broadsheet', museum: 'museum-broadsheet', custom: 'custom',
};

const SHEETS = {
  a4:     { label: 'A4',     w: 210 * MM, h: 297 * MM },
  letter: { label: 'Letter', w: 8.5,      h: 11 },
};

/* ───────────────────────── Utilities ───────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const debounce = (fn, ms) => {
  let t = null, args = [];
  const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  d.flush = () => { if (t) { clearTimeout(t); t = null; fn(...args); } };
  return d;
};

function toast(msg, ms = 2600, action = null) {
  const el = $('#toast');
  el.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-act'; b.textContent = action.label;
    b.addEventListener('click', () => { el.hidden = true; action.fn(); });
    el.append(' ', b);
    el.style.pointerEvents = 'auto';
  } else el.style.pointerEvents = 'none';
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, action ? Math.max(ms, 5000) : ms);
}

async function showProgress(text) {
  $('#progressText').textContent = text;
  $('#progressVeil').hidden = false;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
function hideProgress() { $('#progressVeil').hidden = true; }

function unitToIn(v, unit) { return unit === 'mm' ? v * MM : unit === 'cm' ? v * MM * 10 : v; }
function inToUnit(v, unit) { return unit === 'mm' ? v / MM : unit === 'cm' ? v / MM / 10 : v; }
function fmtIn(v) { return (Math.round(v * 100) / 100) + '″'; }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function sanitizeName(s) {
  return (s || 'postcard').toLowerCase().replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'postcard';
}

/* CRC32 — used for ZIP archives and PNG chunks */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes, crc = 0xFFFFFFFF) {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* ─────────────────── DPI metadata patchers ─────────────────── */
/* Set the JFIF density header of a JPEG to 300 DPI. */
function jpegWithDpi(buf, dpi = DPI) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF && b[3] === 0xE0 &&
      b[6] === 0x4A && b[7] === 0x46 && b[8] === 0x49 && b[9] === 0x46) {
    b[13] = 1;                       // units: dots per inch
    b[14] = (dpi >> 8) & 0xFF; b[15] = dpi & 0xFF;
    b[16] = (dpi >> 8) & 0xFF; b[17] = dpi & 0xFF;
    return b;
  }
  /* No JFIF APP0 — insert one after SOI */
  const app0 = new Uint8Array([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x01, (dpi >> 8) & 0xFF, dpi & 0xFF, (dpi >> 8) & 0xFF, dpi & 0xFF, 0, 0]);
  const out = new Uint8Array(b.length + app0.length);
  out.set(b.subarray(0, 2), 0); out.set(app0, 2); out.set(b.subarray(2), 2 + app0.length);
  return out;
}

/* Insert a pHYs chunk into a PNG so it reports 300 DPI. */
function pngWithDpi(buf, dpi = DPI) {
  const b = new Uint8Array(buf);
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);            // "pHYs"
  dv.setUint32(8, ppm); dv.setUint32(12, ppm);
  chunk[16] = 1;                                      // unit: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  /* insert after IHDR (fixed at offset 8, length 25) */
  const at = 8 + 25;
  const out = new Uint8Array(b.length + chunk.length);
  out.set(b.subarray(0, at)); out.set(chunk, at); out.set(b.subarray(at), at + chunk.length);
  return out;
}

/* ───────────────────── Tiny ZIP writer (store) ───────────────────── */
function makeZip(files) { /* files: [{name, data:Uint8Array}] */
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); dv.setUint16(6, 0, true); dv.setUint16(8, 0, true);
    dv.setUint16(10, dosTime, true); dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, f.data.length, true); dv.setUint32(22, f.data.length, true);
    dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
    local.set(name, 30);
    parts.push(local, f.data);
    const cd = new Uint8Array(46 + name.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true);
    cdv.setUint16(12, dosTime, true); cdv.setUint16(14, dosDate, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, f.data.length, true); cdv.setUint32(24, f.data.length, true);
    cdv.setUint16(28, name.length, true);
    cdv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, files.length, true); edv.setUint16(10, files.length, true);
  edv.setUint32(12, cdSize, true); edv.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

/* ───────────────────── QR code generator ─────────────────────
   Minimal byte-mode QR encoder, ECC level M, versions 1–5,
   fixed mask 0. Based on the public QR specification. */
const QR = (() => {
  const gmul = (x, y) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z & 0xFF;
  };
  const rsDivisor = (deg) => {
    const r = new Uint8Array(deg); r[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) {
        r[j] = gmul(r[j], root);
        if (j + 1 < deg) r[j] ^= r[j + 1];
      }
      root = gmul(root, 2);
    }
    return r;
  };
  const rsRemainder = (data, div) => {
    const res = new Uint8Array(div.length);
    for (const b of data) {
      const f = b ^ res[0];
      res.copyWithin(0, 1); res[div.length - 1] = 0;
      for (let i = 0; i < div.length; i++) res[i] ^= gmul(div[i], f);
    }
    return res;
  };
  /* [totalCodewords, eccPerBlock, numBlocks] at ECC level M */
  const VER = { 1: [26, 10, 1], 2: [44, 16, 1], 3: [70, 26, 1], 4: [100, 18, 2], 5: [134, 24, 2] };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30] };

  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    let ver = 0;
    for (let v = 1; v <= 5; v++) {
      const [total, ecc, nb] = VER[v];
      const dataCw = total - ecc * nb;
      if (bytes.length <= Math.floor((dataCw * 8 - 12) / 8)) { ver = v; break; }
    }
    if (!ver) return null;
    const [total, eccLen, nb] = VER[ver];
    const dataCwTotal = total - eccLen * nb;

    /* bit stream: mode 0100, count (8 bits), data, terminator, pads */
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0b0100, 4); push(bytes.length, 8);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, dataCwTotal * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }
    const pads = [0xEC, 0x11];
    for (let i = 0; data.length < dataCwTotal; i++) data.push(pads[i % 2]);

    /* split into blocks, compute ECC, interleave */
    const per = dataCwTotal / nb;
    const blocks = [], eccs = [];
    const div = rsDivisor(eccLen);
    for (let i = 0; i < nb; i++) {
      const blk = data.slice(i * per, (i + 1) * per);
      blocks.push(blk); eccs.push(rsRemainder(blk, div));
    }
    const stream = [];
    for (let i = 0; i < per; i++) for (const blk of blocks) stream.push(blk[i]);
    for (let i = 0; i < eccLen; i++) for (const e of eccs) stream.push(e[i]);

    /* build matrix */
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fun = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, v) => { mod[y][x] = v; fun[y][x] = true; };

    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    for (let i = 0; i < size; i++) {
      if (!fun[6][i]) set(i, 6, i % 2 === 0);
      if (!fun[i][6]) set(6, i, i % 2 === 0);
    }
    const ap = ALIGN[ver];
    for (const cy of ap) for (const cx of ap) {
      if (fun[cy][cx]) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    /* reserve format areas */
    for (let i = 0; i <= 8; i++) {
      if (i !== 6) { fun[8][i] = true; fun[i][8] = true; }
      fun[8][8] = true;
      if (i < 8) { fun[8][size - 1 - i] = true; fun[size - 1 - i][8] = true; }
    }
    set(8, size - 8, true);   /* dark module */

    /* place data (zigzag) */
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fun[y][x]) {
            let v = false;
            if (bi < stream.length * 8) v = ((stream[bi >> 3] >>> (7 - (bi & 7))) & 1) === 1;
            bi++;
            if ((x + y) % 2 === 0) v = !v;   /* mask 0 */
            mod[y][x] = v;
          }
        }
      }
    }
    /* format bits: ECC M (00), mask 0 → BCH + XOR mask */
    let fmt = 0b00000;
    let rem = fmt << 10;
    for (let i = 4; i >= 0; i--) if (rem >>> (i + 10)) rem ^= 0x537 << i;
    const fbits = ((fmt << 10) | rem) ^ 0x5412;
    const fb = (i) => ((fbits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) mod[8][i] = fb(i);
    mod[8][7] = fb(6); mod[8][8] = fb(7); mod[7][8] = fb(8);
    for (let i = 9; i < 15; i++) mod[14 - i][8] = fb(i);
    for (let i = 0; i < 8; i++) mod[size - 1 - i][8] = fb(i);
    for (let i = 8; i < 15; i++) mod[8][size - 15 + i] = fb(i);
    return mod;
  }
  return { encode };
})();

/* Build a QR module matrix synchronously. Prefers the vendored node-qrcode
   (all versions, EC levels) and falls back to the built-in encoder. Returns
   { size, get(row,col) } or null if the text is empty / can't be encoded. */
const qrCache = new Map();
function qrMatrix(text) {
  const content = (text || '').trim();
  if (!content) return null;
  const full = typeof QRCode !== 'undefined';
  const ck = (full ? 'v:' : 'b:') + content;
  if (qrCache.has(ck)) return qrCache.get(ck);
  if (!full) loadQrLib().then(ok => { if (ok) { qrCache.clear(); view.needsRender = true; } });
  const m = qrMatrixUncached(content);
  if (qrCache.size > 50) qrCache.clear();
  qrCache.set(ck, m);
  return m;
}
function qrMatrixUncached(content) {
  try {
    if (typeof QRCode !== 'undefined' && QRCode.create) {
      const qr = QRCode.create(content, { errorCorrectionLevel: 'M' });
      return { size: qr.modules.size, get: (r, c) => qr.modules.get(r, c) };
    }
  } catch (e) { /* too long for the requested EC level → fall through */ }
  try {
    const m = QR.encode(content);
    if (m) return { size: m.length, get: (r, c) => m[r][c] };
  } catch (e) { /* ignore */ }
  return null;
}

/* Render a QR code into a canvas rect. It is rasterised on a high-resolution
   offscreen canvas (≥400px, integer module size) first, then composited, so
   it never pixelates on the 300 DPI print canvas. */
function drawQr(ctx, text, x, y, w, opts = {}) {
  const dark = opts.dark || '#1a1a1a';
  const light = opts.light || '#ffffff';
  const qr = qrMatrix(text);
  ctx.save();
  if (qr) {
    const quiet = 4;                       /* modules of quiet zone (QR spec) */
    const total = qr.size + quiet * 2;
    const need = Math.max(400, Math.ceil(w));
    const cell = Math.max(3, Math.ceil(need / total));
    const dim = cell * total;
    const oc = drawQr._c || (drawQr._c = document.createElement('canvas'));
    oc.width = dim; oc.height = dim;
    const oq = oc.getContext('2d');
    oq.fillStyle = light; oq.fillRect(0, 0, dim, dim);
    oq.fillStyle = dark;
    for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
      if (qr.get(r, c)) oq.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
    ctx.imageSmoothingEnabled = (dim / w) > 1.6;   /* smooth big downscales, keep print edges crisp */
    ctx.drawImage(oc, x, y, w, w);
  } else {
    ctx.strokeStyle = dark; ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.setLineDash([w * 0.06, w * 0.04]);
    ctx.strokeRect(x, y, w, w);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.65;
    ctx.font = `${w * 0.16}px ${FONTS.sans}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = dark;
    ctx.fillText('QR', x + w / 2, y + w / 2);
  }
  ctx.restore();
}

/* ═══════════════════════ State model ═══════════════════════ */
/* Images live outside the undo-able state, keyed by id. */
const imageStore = new Map();   /* id → {dataURL, img, w, h, name} */

async function addImageFromDataURL(dataURL, name, id = uid()) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataURL; });
  imageStore.set(id, { dataURL, img, w: img.naturalWidth, h: img.naturalHeight, name: name || 'photo' });
  return id;
}

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* Downscale very large photos to a sane maximum (keeps exports sharp
   at 300 DPI while protecting memory on phones). */
async function importPhotoFile(file) {
  /* EXIF must be read from the ORIGINAL file: downscaling re-encodes via
     canvas, which strips all metadata. */
  const exif = await extractExif(file);
  const raw = await readFileAsDataURL(file);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = raw; });
  const MAXDIM = 4200;
  let dataURL = raw;
  if (img.naturalWidth > MAXDIM || img.naturalHeight > MAXDIM) {
    const s = MAXDIM / Math.max(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, c.width, c.height);
    dataURL = c.toDataURL('image/jpeg', 0.94);
  }
  const id = await addImageFromDataURL(dataURL, file.name);
  if (exif) imageStore.get(id).exif = exif;   /* handed to the card in handleFiles */
  return id;
}

/* ── default structures ── */
function defaultFront() {
  return {
    layout: 'gallery',           /* legacy id, kept in sync with `style` */
    style: 'gallery',            /* front archetype (preset) */
    borderW: 0.2, borderBottom: 0, borderColor: '#ffffff',
    fit: 'fill',
    cropAspect: null,
    matHairline: true,
    captionStyle: 'serif',
    overlayCorners: false,
    adjust: { mode: 'none', exposure: 1, contrast: 1 },
    tx: { x: 0, y: 0, zoom: 1, rot: 0 },
    show: { title: false, caption: true, website: false, project: false, copyright: false, logo: false },
    creditPlace: 'center',
    creditFormat: 'photo',
    creditCustom: '',
  };
}

/* Back elements: positions are fractions of trim width/height. */
function backElement(type, o) {
  return Object.assign({
    id: uid(), type, x: 0.1, y: 0.1, w: 0.3, h: 0.1,
    text: '', bind: null, size: 9, font: 'sans', align: 'left',
    color: '#2a2a2a', visible: true, lineHeight: 1.45, style: 'normal', weight: 'normal',
    letterSpacing: 0,
  }, o);
}

const EL_LABELS = {
  caption: 'Caption', story: 'Story', photographer: 'Photographer', copyright: 'Copyright',
  project: 'Project', website: 'Website', date: 'Date', location: 'Location',
  address: 'Address area', stamp: 'Stamp', divider: 'Divider', qr: 'QR code', logo: 'Logo',
  text: 'Custom text', title: 'Title', postmark: 'Postmark',
  box: 'Labelled box', airmail: 'Airmail border', exiftable: 'EXIF table', coords: 'Coordinates',
  bio: 'Bio', contact: 'Contact', cta: 'Headline', edition: 'Edition',
  lines: 'Writing lines', camera: 'Camera', rsvp: 'RSVP line', placeName: 'Place name',
};

function makeBackLayout(layoutId) {
  const els = [];
  const T = (o) => els.push(backElement('text', o));
  switch (layoutId) {
    case 'minimal':
      els.push(backElement('stamp',   { x: 0.855, y: 0.055, w: 0.115, h: 0.24 }));
      els.push(backElement('address', { x: 0.52, y: 0.42, w: 0.44, h: 0.4 }));
      T({ bind: 'caption',  x: 0.05, y: 0.06, w: 0.42, h: 0.09, size: 10.5, font: 'serif', style: 'italic' });
      T({ bind: 'credit',   x: 0.05, y: 0.86, w: 0.42, h: 0.07, size: 7, color: '#7a7a7a' });
      break;
    case 'editorial':
      T({ bind: 'project',  x: 0.05, y: 0.05, w: 0.55, h: 0.07, size: 8, weight: 'bold', letterSpacing: 0.14 });
      els.push(backElement('divider', { x: 0.05, y: 0.145, w: 0.55, h: 0.004 }));
      T({ bind: 'caption',  x: 0.05, y: 0.18, w: 0.42, h: 0.1, size: 11.5, font: 'serif', weight: 'bold' });
      T({ bind: 'story',    x: 0.05, y: 0.3, w: 0.42, h: 0.42, size: 8.5, font: 'serif', lineHeight: 1.6 });
      T({ bind: 'credit',   x: 0.05, y: 0.78, w: 0.42, h: 0.06, size: 7.5 });
      T({ bind: 'website',  x: 0.05, y: 0.86, w: 0.42, h: 0.06, size: 7.5, color: '#7a7a7a' });
      els.push(backElement('stamp',   { x: 0.855, y: 0.055, w: 0.115, h: 0.24 }));
      els.push(backElement('address', { x: 0.55, y: 0.45, w: 0.4, h: 0.38 }));
      break;
    case 'gallery':
      T({ bind: 'caption',  x: 0.05, y: 0.07, w: 0.42, h: 0.09, size: 11, font: 'serif', style: 'italic', align: 'left' });
      T({ bind: 'meta',     x: 0.05, y: 0.19, w: 0.42, h: 0.08, size: 7.5, color: '#7a7a7a' });
      els.push(backElement('divider', { x: 0.5, y: 0.08, w: 0.0035, h: 0.84 }));
      els.push(backElement('stamp',   { x: 0.855, y: 0.055, w: 0.115, h: 0.24 }));
      els.push(backElement('address', { x: 0.55, y: 0.45, w: 0.4, h: 0.38 }));
      T({ bind: 'credit',   x: 0.05, y: 0.8, w: 0.42, h: 0.06, size: 7.5 });
      T({ bind: 'copyright',x: 0.05, y: 0.88, w: 0.42, h: 0.06, size: 7, color: '#7a7a7a' });
      break;
    case 'museum':
      T({ bind: 'caption',  x: 0.05, y: 0.06, w: 0.42, h: 0.08, size: 10.5, weight: 'bold' });
      T({ bind: 'meta',     x: 0.05, y: 0.16, w: 0.42, h: 0.12, size: 8, font: 'serif', style: 'italic', color: '#555555' });
      T({ bind: 'story',    x: 0.05, y: 0.32, w: 0.42, h: 0.38, size: 8, lineHeight: 1.55 });
      T({ bind: 'copyright',x: 0.05, y: 0.86, w: 0.42, h: 0.06, size: 7, color: '#7a7a7a' });
      els.push(backElement('divider', { x: 0.5, y: 0.08, w: 0.0035, h: 0.84 }));
      els.push(backElement('stamp',   { x: 0.855, y: 0.055, w: 0.115, h: 0.24 }));
      els.push(backElement('address', { x: 0.55, y: 0.45, w: 0.4, h: 0.38 }));
      break;
    case 'story':
      T({ bind: 'caption',  x: 0.06, y: 0.07, w: 0.88, h: 0.1, size: 12.5, font: 'serif', weight: 'bold', align: 'center' });
      T({ bind: 'story',    x: 0.1, y: 0.22, w: 0.8, h: 0.5, size: 9, font: 'serif', lineHeight: 1.65, align: 'center' });
      els.push(backElement('divider', { x: 0.35, y: 0.78, w: 0.3, h: 0.004 }));
      T({ bind: 'credit',   x: 0.06, y: 0.85, w: 0.42, h: 0.06, size: 7.5 });
      T({ bind: 'website',  x: 0.52, y: 0.85, w: 0.42, h: 0.06, size: 7.5, align: 'right' });
      break;
    case 'classic':
    case 'custom':
    default:
      T({ bind: 'caption',  x: 0.05, y: 0.06, w: 0.42, h: 0.09, size: 10.5, font: 'serif', style: 'italic' });
      T({ bind: 'story',    x: 0.05, y: 0.18, w: 0.42, h: 0.44, size: 8.5, font: 'serif', lineHeight: 1.55 });
      T({ bind: 'credit',   x: 0.05, y: 0.76, w: 0.42, h: 0.06, size: 7.5 });
      T({ bind: 'copyright',x: 0.05, y: 0.84, w: 0.42, h: 0.06, size: 7, color: '#7a7a7a' });
      els.push(backElement('divider', { x: 0.5, y: 0.08, w: 0.0035, h: 0.84 }));
      els.push(backElement('stamp',   { x: 0.855, y: 0.055, w: 0.115, h: 0.24 }));
      els.push(backElement('address', { x: 0.55, y: 0.42, w: 0.4, h: 0.4 }));
      T({ bind: 'location', x: 0.55, y: 0.88, w: 0.4, h: 0.06, size: 7, color: '#7a7a7a', align: 'right' });
      break;
  }
  return els;
}

/* ── Declarative back presets (authentic postal geometries) ── */
const BACK_PRESETS = [
  {
    id: 'classic-universal', tag: 'Message left, address right', name: 'Classic Universal', category: 'back',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><line x1="20" y1="4" x2="20" y2="24"/><rect x="30" y="4.5" width="6" height="5" stroke-dasharray="1.4 1"/><line x1="23" y1="15" x2="36" y2="15" stroke-width="0.8"/><line x1="23" y1="18.5" x2="36" y2="18.5" stroke-width="0.8"/><line x1="23" y1="22" x2="36" y2="22" stroke-width="0.8"/><line x1="4" y1="7" x2="16" y2="7" stroke-width="0.8" opacity=".6"/>'),
    elements: [
      { type: 'divider', x: 0.5, y: 0.07, w: 0.0035, h: 0.86 },
      { type: 'stamp', x: 0.855, y: 0.05, w: 0.115, h: 0.22 },
      { type: 'text', bind: 'caption', x: 0.05, y: 0.06, w: 0.4, h: 0.08, size: 10, font: 'serif', style: 'italic' },
      { type: 'text', bind: 'story', x: 0.05, y: 0.2, w: 0.4, h: 0.5, size: 8.5, font: 'serif', lineHeight: 1.5 },
      { type: 'text', bind: 'credit', x: 0.05, y: 0.86, w: 0.4, h: 0.06, size: 7, color: '#7a7a7a' },
      { type: 'address', x: 0.55, y: 0.44, w: 0.4, h: 0.4 },
      { type: 'text', bind: 'location', x: 0.55, y: 0.88, w: 0.4, h: 0.05, size: 6.5, color: '#8a8a8a', align: 'right' },
    ],
  },
  {
    id: 'field-note', tag: 'Story column with camera details', name: 'Field Note', category: 'back',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><line x1="4" y1="6" x2="18" y2="6" stroke-width="0.8"/><line x1="4" y1="9" x2="18" y2="9" stroke-width="0.6" opacity=".6"/><line x1="4" y1="11.5" x2="18" y2="11.5" stroke-width="0.6" opacity=".6"/><line x1="4" y1="14" x2="16" y2="14" stroke-width="0.6" opacity=".6"/><rect x="22" y="5" width="14" height="8" stroke-width="0.7" opacity=".7"/><rect x="22" y="17" width="6" height="6" stroke-dasharray="1.2 1"/>'),
    elements: [
      { type: 'text', bind: 'caption', x: 0.05, y: 0.06, w: 0.42, h: 0.07, size: 10, weight: 'bold' },
      { type: 'text', bind: 'story', x: 0.05, y: 0.16, w: 0.42, h: 0.76, size: 7.8, font: 'serif', lineHeight: 1.5 },
      { type: 'divider', x: 0.52, y: 0.06, w: 0.0035, h: 0.86 },
      { type: 'text', bind: 'exiftable', x: 0.57, y: 0.06, w: 0.38, h: 0.28, size: 7, font: 'mono', lineHeight: 1.7, color: '#3a3a3a' },
      { type: 'box', label: 'LOCATION', bind: 'coords', x: 0.57, y: 0.42, w: 0.38, h: 0.16, size: 7.5, font: 'mono' },
      { type: 'qr', x: 0.57, y: 0.64, w: 0.14, h: 0.14, qrDark: '#1a1a1a', qrLight: '#ffffff' },
      { type: 'text', bind: 'credit', x: 0.74, y: 0.68, w: 0.22, h: 0.1, size: 6.5, color: '#7a7a7a' },
    ],
  },
  {
    id: 'art-print', tag: 'Centred title, bio and edition', name: 'Art Print', category: 'back',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><line x1="12" y1="6" x2="28" y2="6" stroke-width="1.4"/><line x1="14" y1="12" x2="26" y2="12" stroke-width="0.6" opacity=".6"/><line x1="14" y1="14.5" x2="26" y2="14.5" stroke-width="0.6" opacity=".6"/><rect x="13" y="18.5" width="14" height="4" stroke-width="0.7" opacity=".7"/>'),
    elements: [
      { type: 'text', bind: 'project', x: 0.1, y: 0.07, w: 0.8, h: 0.06, size: 8, weight: 'bold', align: 'center', letterSpacing: 0.16 },
      { type: 'text', bind: 'caption', x: 0.1, y: 0.16, w: 0.8, h: 0.08, size: 12, font: 'serif', style: 'italic', align: 'center' },
      { type: 'text', bind: 'bio', x: 0.18, y: 0.3, w: 0.64, h: 0.24, size: 8, font: 'serif', lineHeight: 1.6, align: 'center', color: '#4a4a4a' },
      { type: 'box', label: 'EDITION', bind: 'edition', x: 0.32, y: 0.6, w: 0.36, h: 0.12, size: 8, align: 'center' },
      { type: 'text', bind: 'copyright', x: 0.1, y: 0.86, w: 0.8, h: 0.05, size: 6.5, align: 'center', color: '#8a8a8a' },
    ],
  },
  {
    id: 'airmail', tag: 'Striped border and a postmark', name: 'Airmail', category: 'back',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><rect x="3.5" y="3.5" width="33" height="21" stroke-dasharray="2 1.4" stroke-width="1"/><circle cx="30" cy="9" r="4" stroke-width="0.9"/><line x1="6" y1="16" x2="22" y2="16" stroke-width="0.7" opacity=".6"/><line x1="6" y1="19" x2="22" y2="19" stroke-width="0.7" opacity=".6"/>'),
    elements: [
      { type: 'airmail', x: 0.012, y: 0.02, w: 0.976, h: 0.96 },
      { type: 'postmark', x: 0.5, y: 0.05, w: 0.44, h: 0.2, ink: '#3b4a56', city: null, date: null, blend: 'multiply', opacity: 0.85, waves: 5 },
      { type: 'text', bind: 'caption', x: 0.06, y: 0.08, w: 0.4, h: 0.08, size: 9.5, font: 'mono', weight: 'bold' },
      { type: 'text', bind: 'story', x: 0.06, y: 0.2, w: 0.4, h: 0.5, size: 7.5, font: 'mono', lineHeight: 1.6 },
      { type: 'text', bind: 'credit', x: 0.06, y: 0.86, w: 0.4, h: 0.05, size: 6.5, font: 'mono', color: '#7a7a7a' },
      { type: 'address', x: 0.55, y: 0.5, w: 0.38, h: 0.34 },
    ],
  },
  {
    id: 'direct-mailer', tag: 'Headline, QR and contact block', name: 'Promo Mailer', category: 'back',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><rect x="4" y="4.5" width="22" height="4" fill="currentColor" opacity=".55"/><line x1="4" y1="11" x2="24" y2="11" stroke-width="0.6" opacity=".6"/><line x1="4" y1="13.5" x2="24" y2="13.5" stroke-width="0.6" opacity=".6"/><rect x="29" y="4.5" width="7" height="7" stroke-dasharray="1.2 1"/><rect x="4" y="20" width="16" height="3.5" stroke-width="0.7" opacity=".5"/>'),
    elements: [
      { type: 'text', bind: 'cta', x: 0.05, y: 0.06, w: 0.62, h: 0.12, size: 15, weight: 'bold', color: '#1a1a1a' },
      { type: 'text', bind: 'story', x: 0.05, y: 0.24, w: 0.58, h: 0.34, size: 8.5, lineHeight: 1.5 },
      { type: 'text', bind: 'contact', x: 0.05, y: 0.62, w: 0.58, h: 0.22, size: 8, lineHeight: 1.7, color: '#3a3a3a' },
      { type: 'qr', x: 0.72, y: 0.06, w: 0.22, h: 0.22, qrDark: '#1a1a1a', qrLight: '#ffffff' },
      { type: 'text', bind: 'website', x: 0.72, y: 0.3, w: 0.22, h: 0.05, size: 7, align: 'center', color: '#7a7a7a' },
      { type: 'box', label: 'BARCODE CLEARANCE', x: 0.68, y: 0.78, w: 0.28, h: 0.14, size: 6, align: 'center', dashed: true },
    ],
  },
  {
    id: 'handwritten', name: 'Room to Write', category: 'back', tag: 'Ruled lines for a handwritten note',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><line x1="20" y1="4" x2="20" y2="24"/><g stroke-width=".6" opacity=".6"><line x1="4" y1="9" x2="18" y2="9"/><line x1="4" y1="12.5" x2="18" y2="12.5"/><line x1="4" y1="16" x2="18" y2="16"/><line x1="4" y1="19.5" x2="18" y2="19.5"/><line x1="23" y1="15" x2="36" y2="15"/><line x1="23" y1="18.5" x2="36" y2="18.5"/><line x1="23" y1="22" x2="36" y2="22"/></g><rect x="30" y="4.5" width="6" height="5" stroke-dasharray="1.4 1"/>'),
    elements: [
      { type: 'text', bind: 'caption', x: 0.05, y: 0.06, w: 0.4, h: 0.08, size: 13, font: 'editorial', style: 'italic' },
      { type: 'lines', x: 0.05, y: 0.2, w: 0.41, h: 0.62, lines: 7, color: '#c9c3b6' },
      { type: 'text', bind: 'credit', x: 0.05, y: 0.88, w: 0.41, h: 0.05, size: 6.5, color: '#8a8a8a' },
      { type: 'divider', x: 0.5, y: 0.07, w: 0.0035, h: 0.86 },
      { type: 'stamp', x: 0.855, y: 0.05, w: 0.115, h: 0.22 },
      { type: 'address', x: 0.55, y: 0.44, w: 0.4, h: 0.4 },
    ],
  },
  {
    id: 'thank-you', name: 'Thank You', category: 'back', tag: 'Script greeting, space for a note',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><path d="M5 9c2-3 4 2 6-1s3 2 5 0" stroke-width="1.3"/><g stroke-width=".6" opacity=".6"><line x1="4" y1="14" x2="18" y2="14"/><line x1="4" y1="17.5" x2="18" y2="17.5"/><line x1="4" y1="21" x2="18" y2="21"/></g><line x1="20" y1="4" x2="20" y2="24"/><rect x="30" y="4.5" width="6" height="5" stroke-dasharray="1.4 1"/>'),
    elements: [
      { type: 'text', text: 'Thank you', x: 0.05, y: 0.05, w: 0.42, h: 0.2, size: 28, font: 'editorial', style: 'italic', color: '#2a4d8f', lineHeight: 1.1 },
      { type: 'text', bind: 'story', x: 0.05, y: 0.3, w: 0.41, h: 0.36, size: 8.5, font: 'serif', lineHeight: 1.55 },
      { type: 'lines', x: 0.05, y: 0.68, w: 0.41, h: 0.18, lines: 2, color: '#c9c3b6' },
      { type: 'text', bind: 'website', x: 0.05, y: 0.9, w: 0.41, h: 0.05, size: 6.5, color: '#8a8a8a' },
      { type: 'divider', x: 0.5, y: 0.07, w: 0.0035, h: 0.86 },
      { type: 'stamp', x: 0.855, y: 0.05, w: 0.115, h: 0.22 },
      { type: 'address', x: 0.55, y: 0.44, w: 0.4, h: 0.4 },
    ],
  },
  {
    id: 'event-invite', name: 'Invitation', category: 'back', tag: 'Event name, when, where, RSVP',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><line x1="14" y1="6" x2="26" y2="6" stroke-width=".7"/><line x1="10" y1="10" x2="30" y2="10" stroke-width="2.2"/><rect x="7" y="14" width="12" height="5" stroke-width=".7"/><rect x="21" y="14" width="12" height="5" stroke-width=".7"/><line x1="14" y1="22.5" x2="26" y2="22.5" stroke-width=".7"/>'),
    elements: [
      { type: 'text', bind: 'project', x: 0.1, y: 0.07, w: 0.8, h: 0.06, size: 7, weight: 'bold', align: 'center', letterSpacing: 0.18, color: '#7a7a7a' },
      { type: 'text', bind: 'title', x: 0.08, y: 0.15, w: 0.84, h: 0.17, size: 26, font: 'editorial', align: 'center', lineHeight: 1.05 },
      { type: 'text', bind: 'story', x: 0.16, y: 0.35, w: 0.68, h: 0.18, size: 8.5, font: 'serif', align: 'center', lineHeight: 1.5, color: '#4a4a4a' },
      { type: 'box', label: 'WHEN', bind: 'date', x: 0.16, y: 0.58, w: 0.32, h: 0.17, size: 9, font: 'serif' },
      { type: 'box', label: 'WHERE', bind: 'location', x: 0.52, y: 0.58, w: 0.32, h: 0.17, size: 9, font: 'serif' },
      { type: 'text', bind: 'rsvp', x: 0.1, y: 0.84, w: 0.8, h: 0.06, size: 7.5, align: 'center', letterSpacing: 0.06 },
    ],
  },
  {
    id: 'specimen', name: 'Specimen Label', category: 'back', tag: 'Typewritten field-record table',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><rect x="4" y="4.5" width="15" height="19" stroke-width=".8"/><g stroke-width=".5" opacity=".7"><line x1="4" y1="9" x2="19" y2="9"/><line x1="4" y1="13" x2="19" y2="13"/><line x1="4" y1="17" x2="19" y2="17"/></g><line x1="22" y1="15" x2="36" y2="15" stroke-width=".7"/><line x1="22" y1="18.5" x2="36" y2="18.5" stroke-width=".7"/><rect x="30" y="4.5" width="6" height="5" stroke-dasharray="1.4 1"/>'),
    elements: [
      { type: 'text', text: 'FIELD RECORD', x: 0.05, y: 0.06, w: 0.42, h: 0.06, size: 7, font: 'mono', weight: 'bold', letterSpacing: 0.2 },
      { type: 'box', label: 'SUBJECT', bind: 'caption', x: 0.05, y: 0.14, w: 0.42, h: 0.13, size: 8, font: 'mono' },
      { type: 'box', label: 'LOCALITY', bind: 'location', x: 0.05, y: 0.27, w: 0.42, h: 0.13, size: 8, font: 'mono' },
      { type: 'box', label: 'DATE', bind: 'date', x: 0.05, y: 0.4, w: 0.21, h: 0.13, size: 8, font: 'mono' },
      { type: 'box', label: 'CAMERA', bind: 'camera', x: 0.26, y: 0.4, w: 0.21, h: 0.13, size: 7, font: 'mono' },
      { type: 'box', label: 'NOTES', bind: 'story', x: 0.05, y: 0.53, w: 0.42, h: 0.33, size: 7, font: 'mono' },
      { type: 'text', bind: 'credit', x: 0.05, y: 0.89, w: 0.42, h: 0.05, size: 6.5, font: 'mono', color: '#7a7a7a' },
      { type: 'stamp', x: 0.855, y: 0.05, w: 0.115, h: 0.22 },
      { type: 'address', x: 0.55, y: 0.44, w: 0.4, h: 0.4 },
    ],
  },
  {
    id: 'modern-postal', name: 'Bold Place Name', category: 'back', tag: 'Poster type with a heavy rule',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><rect x="4" y="5" width="13" height="5" fill="currentColor" opacity=".8"/><g stroke-width=".6" opacity=".6"><line x1="4" y1="13" x2="17" y2="13"/><line x1="4" y1="15.5" x2="17" y2="15.5"/><line x1="4" y1="18" x2="15" y2="18"/></g><line x1="20" y1="4" x2="20" y2="24" stroke-width="2"/><rect x="30" y="4.5" width="6" height="5" stroke-dasharray="1.4 1"/><line x1="23" y1="18.5" x2="36" y2="18.5" stroke-width=".7"/>'),
    elements: [
      { type: 'text', bind: 'placeName', x: 0.05, y: 0.05, w: 0.42, h: 0.2, size: 30, font: 'display', lineHeight: 1, color: '#1c1a17' },
      { type: 'text', bind: 'date', x: 0.05, y: 0.27, w: 0.42, h: 0.05, size: 7, weight: 'bold', letterSpacing: 0.14, color: '#c23b22' },
      { type: 'text', bind: 'story', x: 0.05, y: 0.36, w: 0.41, h: 0.46, size: 8.5, lineHeight: 1.55 },
      { type: 'text', bind: 'credit', x: 0.05, y: 0.88, w: 0.41, h: 0.05, size: 6.5, color: '#7a7a7a' },
      { type: 'divider', x: 0.5, y: 0.06, w: 0.009, h: 0.88, color: '#1c1a17' },
      { type: 'stamp', x: 0.855, y: 0.05, w: 0.115, h: 0.22 },
      { type: 'address', x: 0.56, y: 0.44, w: 0.39, h: 0.4 },
    ],
  },
  {
    id: 'blank-mail', name: 'Plain Mail', category: 'back', tag: 'Just the essentials, write by hand',
    thumbnailSvg: T('<rect x="2.5" y="2.5" width="35" height="23" rx="1.5" fill="currentColor" opacity=".05"/><line x1="20" y1="6" x2="20" y2="22" stroke-width=".7"/><rect x="30" y="4.5" width="6" height="5" stroke-dasharray="1.4 1"/><g stroke-width=".7"><line x1="23" y1="15" x2="36" y2="15"/><line x1="23" y1="18.5" x2="36" y2="18.5"/><line x1="23" y1="22" x2="36" y2="22"/></g>'),
    elements: [
      { type: 'divider', x: 0.5, y: 0.12, w: 0.0025, h: 0.76 },
      { type: 'stamp', x: 0.855, y: 0.05, w: 0.115, h: 0.22 },
      { type: 'address', x: 0.55, y: 0.46, w: 0.4, h: 0.36, showLabel: false },
      { type: 'text', bind: 'credit', x: 0.05, y: 0.9, w: 0.4, h: 0.05, size: 6, color: '#9a9a9a' },
    ],
  },
];
const BACK_PRESET_IDS = new Set(BACK_PRESETS.map(p => p.id));
/* legacy back layout id → new preset id */
const BACK_LAYOUT_ALIAS = {
  classic: 'classic-universal', minimal: 'art-print', editorial: 'field-note',
  gallery: 'classic-universal', museum: 'field-note', story: 'art-print',
};

function instantiateBackElements(specs) {
  return specs.map(s => backElement(s.type, { ...s }));
}

function defaultBack(layoutId = 'classic-universal') {
  const preset = BACK_PRESETS.find(p => p.id === layoutId);
  const elements = preset ? instantiateBackElements(preset.elements) : makeBackLayout(layoutId);
  return {
    layout: layoutId,
    elements,
    qrOn: false, qrText: '',
    logoOn: false,
  };
}

function makeCard(imageId, name) {
  return {
    id: uid(),
    imageId: imageId || null,
    name: sanitizeName(name),
    meta: { title: '', caption: '', story: '', location: '', date: '', edition: '', camera: '' },
    exif: null,
    front: defaultFront(),
    back: defaultBack(),
  };
}

const state = {
  cards: [],
  sel: 0,                          /* selected card index */
  size: { preset: '4x6', w: 6, h: 4, orient: 'landscape', unit: 'in' },
  bleedOn: true, marksOn: true, safeOn: true,
  global: { photographer: '', project: '', website: '', email: '', copyright: '', logoId: null },
  projectName: 'project',
  export: {
    format: 'jpg', sides: 'both', scope: 'all',
    pdfMode: 'cards', edge: 'long', bleed: true, marks: true,
    pattern: '{name}-{side}', custom: '',
  },
  ui: { view: 'front', side: 'front', guides: true },
};

function currentCard() { return state.cards[state.sel] || null; }

/* trim size in inches, honouring orientation */
function trimSize() {
  let { w, h } = state.size;
  if (state.size.orient === 'portrait' ? w > h : w < h) [w, h] = [h, w];
  return { w, h };
}
function bleedIn() { return state.bleedOn ? BLEED_IN : 0; }

/* ═══════════════════════ Undo / redo ═══════════════════════ */
const history = { stack: [], idx: -1, MAX: 60 };

function snapshot() {
  return JSON.stringify({
    cards: state.cards, sel: state.sel, size: state.size,
    bleedOn: state.bleedOn, marksOn: state.marksOn, safeOn: state.safeOn,
    global: state.global, projectName: state.projectName, export: state.export,
  });
}
function commit() {
  const s = snapshot();
  if (history.stack[history.idx] === s) return;
  history.stack.length = history.idx + 1;
  history.stack.push(s);
  if (history.stack.length > history.MAX) history.stack.shift();
  history.idx = history.stack.length - 1;
  updateUndoButtons();
  autosaveSoon();
}
function restore(s) {
  const o = JSON.parse(s);
  Object.assign(state, {
    cards: o.cards, sel: Math.min(o.sel, o.cards.length - 1), size: o.size,
    bleedOn: o.bleedOn, marksOn: o.marksOn, safeOn: o.safeOn,
    global: o.global, projectName: o.projectName, export: o.export,
  });
  selectedEl = null;
  syncAllInputs(); renderTimeline(); renderMediaList(); requestRender();
  autosaveSoon();
}
function undo() { if (history.idx > 0) { history.idx--; restore(history.stack[history.idx]); updateUndoButtons(); } }
function redo() { if (history.idx < history.stack.length - 1) { history.idx++; restore(history.stack[history.idx]); updateUndoButtons(); } }
function updateUndoButtons() {
  $('#btnUndo').disabled = history.idx <= 0;
  $('#btnRedo').disabled = history.idx >= history.stack.length - 1;
}

/* ═══════════════════ Local persistence (IndexedDB) ═══════════════════ */
const DB_NAME = 'postcard-press', DB_STORE = 'project';
function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbSet(key, val) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(val, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) { /* private mode etc. — silently skip autosave */ }
}
async function idbGet(key) {
  try {
    const db = await openDb();
    const v = await new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const rq = tx.objectStore(DB_STORE).get(key);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
    db.close();
    return v;
  } catch (e) { return null; }
}

/* Images that something still points at. Images are never deleted while
   editing (so undo can bring a card back with its photo); unused ones are
   simply left out when the project is saved. */
function referencedImageIds() {
  const ids = new Set();
  const add = (id) => { if (id) ids.add(id); };
  const scan = (cards) => cards.forEach(c => {
    add(c.imageId); add(c.imageId2);
    (c.back.elements || []).forEach(e => add(e.stampImageId));
  });
  scan(state.cards);
  add(state.global.logoId);
  return ids;
}
function serializeProject() {
  const images = {};
  const used = referencedImageIds();
  for (const [id, im] of imageStore) if (used.has(id)) images[id] = { dataURL: im.dataURL, name: im.name };
  return {
    app: 'postcard-press', version: 1, savedAt: new Date().toISOString(),
    state: JSON.parse(snapshot()), images,
  };
}
async function loadProjectData(data) {
  if (!data || data.app !== 'postcard-press') throw new Error('Not a Postcard Press project file');
  imageStore.clear();
  for (const [id, im] of Object.entries(data.images || {})) {
    try { await addImageFromDataURL(im.dataURL, im.name, id); } catch (e) { /* skip broken image */ }
  }
  restore(JSON.stringify(data.state));
  (state.cards || []).forEach(normalizeCard);
  history.stack = [snapshot()]; history.idx = 0;
  updateUndoButtons();
}

/* Backfill fields added in later versions so older archives keep working. */
function normalizeCard(card) {
  const f = card.front || (card.front = defaultFront());
  if (!f.style) f.style = FRONT_LAYOUT_ALIAS[f.layout] || 'gallery';
  if (f.matHairline === undefined) f.matHairline = false;
  if (!f.captionStyle) f.captionStyle = 'serif';
  if (f.overlayCorners === undefined) f.overlayCorners = false;
  if (!f.adjust) f.adjust = { mode: 'none', exposure: 1, contrast: 1 };
  if (f.cropAspect === undefined) f.cropAspect = null;
  if (card.imageId2 === undefined) card.imageId2 = null;
  if (card.exif === undefined) card.exif = null;
}

/* Load a dropped/picked .postcard (JSON) archive into the workspace. */
async function restoreProjectFile(file) {
  try {
    await showProgress('Restoring project…');
    const data = JSON.parse(await file.text());
    await loadProjectData(data);
    zoomFit();
    toast('Project restored.');
  } catch (err) {
    console.error(err);
    toast('That file is not a valid Postcard Press project.');
  } finally {
    hideProgress();
  }
}

/* Autosave writes each photo once under its own key and then only the
   (small) design state on every change — much cheaper than re-saving every
   photo each time. */
const savedImageKeys = new Set();
async function autosaveNow() {
  const used = referencedImageIds();
  for (const id of used) {
    if (savedImageKeys.has(id) || !imageStore.has(id)) continue;
    const im = imageStore.get(id);
    await idbSet('img:' + id, { dataURL: im.dataURL, name: im.name });
    savedImageKeys.add(id);
  }
  await idbSet('autosave', { app: 'postcard-press', version: 2, savedAt: new Date().toISOString(), state: JSON.parse(snapshot()), imageIds: [...used] });
}
const autosaveSoon = debounce(() => { autosaveNow(); }, 1000);
async function loadAutosave() {
  const saved = await idbGet('autosave');
  if (!saved || !saved.state || !saved.state.cards || !saved.state.cards.length) return false;
  if (saved.version === 2) {
    const images = {};
    for (const id of saved.imageIds || []) {
      const im = await idbGet('img:' + id);
      if (im) { images[id] = im; savedImageKeys.add(id); }
    }
    await loadProjectData({ app: 'postcard-press', state: saved.state, images });
  } else {
    await loadProjectData(saved);   /* older single-blob autosave */
  }
  return true;
}

/* ═══════════════════════ Text helpers ═══════════════════════ */
function fontStr(sizePx, font = 'sans', style = 'normal', weight = 'normal') {
  return `${style === 'italic' ? 'italic ' : ''}${weight === 'bold' ? '600 ' : ''}${sizePx}px ${FONTS[font] || FONTS.sans}`;
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + ' ' + words[i];
      if (ctx.measureText(test).width <= maxW) line = test;
      else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  return out;
}

function drawWrapped(ctx, text, x, y, maxW, lineH, align = 'left', maxH = Infinity) {
  const lines = wrapLines(ctx, text, maxW);
  ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + maxW / 2 : align === 'right' ? x + maxW : x;
  let cy = y;
  for (const line of lines) {
    if (cy + lineH > y + maxH + 0.01) break;
    ctx.fillText(line, ax, cy);
    cy += lineH;
  }
  return cy - y;
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#ffffff');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
}

/* True while a card is being drawn for a file/print. Placeholder words
   ("Your Name", "Your Website"…) are shown on screen as hints but must never
   end up on a printed card. */
let EXPORTING = false;

/* resolved text values; empty fields fall back to a hint on screen only */
const G_HINT = { photographer: 'Your Name', project: 'Project Name', website: 'Your Website', email: 'Your Email' };
function hasG(key) { return !!(state.global[key] || '').trim(); }
function gv(key) {
  const g = state.global;
  if (key === 'copyright') {
    if (g.copyright.trim()) return g.copyright.trim();
    if (!hasG('photographer') && EXPORTING) return '';
    return `© ${new Date().getFullYear()} ${gv('photographer')}`;
  }
  const v = (g[key] || '').trim();
  if (v) return v;
  return EXPORTING ? '' : (G_HINT[key] || '');
}
function creditText(card) {
  const f = card.front;
  if (f.creditFormat === 'custom' && f.creditCustom.trim()) return applyTokens(f.creditCustom.trim(), card);
  if (!hasG('photographer') && EXPORTING) return '';
  const name = gv('photographer');
  switch (f.creditFormat) {
    case 'photograph': return `Photograph by ${name}`;
    case 'copy':       return `© ${name}`;
    case 'studio':     return `${name} / Studio`;
    default:           return `Photo: ${name}`;
  }
}
function bindText(card, bind) {
  const m = card.meta;
  switch (bind) {
    case 'caption':   return m.caption.trim() || m.title.trim();
    case 'story':     return m.story.trim();
    case 'credit':    return creditText(card);
    case 'copyright': return gv('copyright');
    case 'project':   return gv('project');
    case 'website':   return gv('website');
    case 'date':      return m.date.trim();
    case 'location':  return m.location.trim();
    case 'title':     return m.title.trim();
    case 'camera':    return (m.camera || '').trim() || (card.exif && card.exif.camera) || '';
    case 'placeName': return (m.location.trim() || m.title.trim()).toUpperCase();
    case 'rsvp':      return hasG('website') || hasG('email') ? `RSVP  ${[state.global.email.trim(), state.global.website.trim()].filter(Boolean).join('  ·  ')}` : '';
    case 'meta': {
      const bits = [m.location.trim(), m.date.trim(), m.edition.trim(), m.camera.trim()].filter(Boolean);
      return bits.join('  ·  ');
    }
    case 'exiftable': {
      const e = card.exif || {};
      const rows = [
        ['Camera', (m.camera && m.camera.trim()) || e.camera],
        ['Lens', e.lens],
        ['Exposure', e.settings],
        ['Date', (m.date && m.date.trim()) || e.date],
      ].filter(r => r[1]);
      if (!rows.length) return '';
      const pad = Math.max(...rows.map(r => r[0].length));
      return rows.map(([k, v]) => `${k.padEnd(pad)}  ${v}`).join('\n');
    }
    case 'coords':  return m.location.trim() || '';
    case 'bio':     return (hasG('photographer') || m.story.trim()) ? [gv('photographer'), gv('website')].filter(Boolean).join('\n') : '';
    case 'contact': {
      const bits = [gv('photographer'), gv('website'), gv('email')].filter(v => v && !/^Your /.test(v));
      return bits.join('\n');
    }
    case 'cta':     return m.title.trim() || m.caption.trim();
    case 'edition': return m.edition.trim();
  }
  return '';
}
function bindTextReal(card, bind) {
  const prev = EXPORTING; EXPORTING = true;
  try { return bindText(card, bind); } finally { EXPORTING = prev; }
}
const BIND_PLACEHOLDER = {
  caption: 'Photo Title', story: 'The story behind this photograph…',
  date: '2026', location: 'Your Location', meta: 'Your Location · 2026', title: 'Photo Title',
  exiftable: 'Camera   Your camera\nLens     Your lens\nExposure 35mm · ƒ/1.4 · 1/500s\nDate     2026',
  coords: 'Your Location', bio: 'Photographer Name\nyour-website.com',
  contact: 'Your Name\nyour-website.com\nyour@email.com', cta: 'Your Headline Here',
  edition: 'Edition ____ of ____',
  camera: 'Camera / film', placeName: 'YOUR PLACE', rsvp: 'RSVP  you@example.com',
};

/* ═══════════════════════ EXIF metadata ═══════════════════════
   Parsed client-side via the vendored exifr (lite) build. Nothing is
   uploaded — the file is read in-browser and only these tags are kept. */
const EXIF_TAGS = ['Make', 'Model', 'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'ISOSpeedRatings', 'DateTimeOriginal'];

function fmtShutter(t) {
  if (!(t > 0)) return '';
  if (t >= 1) return `${Math.round(t * 10) / 10}s`;
  return `1/${Math.round(1 / t)}s`;
}
function fmtCamera(make, model) {
  make = (make || '').trim(); model = (model || '').trim();
  if (!model) return make;
  /* camera Model often already includes the Make — avoid "Canon Canon EOS" */
  if (make && model.toLowerCase().startsWith(make.toLowerCase())) return model;
  return make ? `${make} ${model}` : model;
}
function fmtExifDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function buildSettings(e) {
  const bits = [];
  if (e.focalLength) bits.push(`${Math.round(e.focalLength)}mm`);
  if (e.fNumber) bits.push(`ƒ/${Math.round(e.fNumber * 10) / 10}`);
  if (e.shutter) bits.push(e.shutter);
  if (e.iso) bits.push(`ISO ${e.iso}`);
  return bits.join(' · ');
}

/* Read EXIF from a File; resolves to a normalized object (or null). */
async function extractExif(file) {
  try {
    await loadExifLib();
    if (typeof exifr === 'undefined' || !exifr.parse) return null;
    /* The lite build only parses TIFF/EXIF/GPS (no IPTC/XMP/ICC), so a plain
       parse is already fast; the pick/translateValues options are avoided
       because they throw in this build. */
    const raw = await exifr.parse(file);
    if (!raw) return null;
    const e = {
      make: raw.Make || '', model: raw.Model || '',
      lens: raw.LensModel || '',
      focalLength: raw.FocalLength || null,
      fNumber: raw.FNumber || null,
      shutter: fmtShutter(raw.ExposureTime),
      iso: raw.ISO || raw.ISOSpeedRatings || null,
      date: fmtExifDate(raw.DateTimeOriginal),
    };
    e.camera = fmtCamera(e.make, e.model);
    e.settings = buildSettings(e);
    /* keep only if something meaningful was found */
    if (!e.camera && !e.lens && !e.settings && !e.date) return null;
    return e;
  } catch (err) {
    console.warn('EXIF parse skipped:', err);
    return null;
  }
}

/* Seed a new card's editable fields from EXIF (without clobbering user text). */
function applyExifToCard(card, exif) {
  if (!exif) return;
  card.exif = exif;
  if (!card.meta.camera && exif.camera) card.meta.camera = exif.camera;
  if (!card.meta.date && exif.date) card.meta.date = exif.date;
}

/* ═══════════════════════ Text tokens ═══════════════════════
   {camera} {lens} {settings} {date} {title} {photographer} may appear in
   any text field and are resolved live from the card's metadata/EXIF. */
const TOKENS = [
  { key: 'title', label: 'Title' },
  { key: 'photographer', label: 'Photographer' },
  { key: 'camera', label: 'Camera' },
  { key: 'lens', label: 'Lens' },
  { key: 'settings', label: 'Settings' },
  { key: 'date', label: 'Date' },
];
function tokenValue(card, key) {
  const e = card.exif || {};
  const m = card.meta;
  switch (key) {
    case 'camera':       return (m.camera && m.camera.trim()) || e.camera || '';
    case 'lens':         return e.lens || '';
    case 'settings':     return e.settings || '';
    case 'date':         return (m.date && m.date.trim()) || e.date || '';
    case 'title':        return (m.title && m.title.trim()) || '';
    case 'photographer': return gv('photographer');
  }
  return '';
}
function applyTokens(text, card) {
  if (!text || !card || text.indexOf('{') < 0) return text;
  return text.replace(/\{(camera|lens|settings|date|title|photographer)\}/g, (_, k) => tokenValue(card, k));
}

/* ═══════════════════ Aspect crop & tonal adjustments ═══════════════════ */
const CROP_ASPECTS = [
  { id: 'native', label: 'Native', ratio: null },
  { id: '3:2',    label: '3:2',    ratio: 3 / 2 },
  { id: '4:3',    label: '4:3',    ratio: 4 / 3 },
  { id: '1:1',    label: '1:1',    ratio: 1 },
  { id: '16:9',   label: '16:9',   ratio: 16 / 9 },
  { id: '65:24',  label: '65:24 XPan', ratio: 65 / 24 },
];
const ADJUST_MODES = [
  { id: 'none', label: 'Original' },
  { id: 'bw',   label: 'B&W' },
  { id: 'bwhc', label: 'B&W High-contrast' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
];
/* Build a canvas filter string (non-destructive; applied at draw time). */
function adjustFilter(a) {
  if (!a) return 'none';
  const parts = [];
  if (a.mode === 'bw' || a.mode === 'bwhc') parts.push('grayscale(1)');
  const exp = (a.exposure ?? 1) * (a.mode === 'bwhc' ? 1.05 : 1);
  const con = (a.contrast ?? 1) * (a.mode === 'bwhc' ? 1.4 : 1);
  if (Math.abs(exp - 1) > 0.001) parts.push(`brightness(${exp.toFixed(3)})`);
  if (Math.abs(con - 1) > 0.001) parts.push(`contrast(${con.toFixed(3)})`);
  return parts.length ? parts.join(' ') : 'none';
}
function adjustTint(a) {
  if (!a) return null;
  if (a.mode === 'warm') return 'rgba(255,168,80,0.5)';
  if (a.mode === 'cool') return 'rgba(70,150,255,0.42)';
  return null;
}

/* resolve the active front archetype/preset id (with legacy fallback) */
function frontStyle(f) { return f.style || FRONT_LAYOUT_ALIAS[f.layout] || 'classic-gallery'; }

/* Draw one photo into a rect: clip, fill/fit preserving aspect, pan/zoom/rotate,
   apply the non-destructive tonal filter, then a warm/cool tint wash. Reused by
   the single-photo path and both diptych panes. */
function drawPhotoInto(ctx, im, o) {
  const { x, y, w, h, fit, tx, adjust, ppi } = o;
  const out = { ox: 0, oy: 0 };
  if (w < 2 || h < 2) return out;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (im) {
    const rot = (((tx.rot || 0) % 360) + 360) % 360;
    const sideways = rot === 90 || rot === 270;
    const iw = sideways ? im.h : im.w, ih = sideways ? im.w : im.h;
    const base = fit === 'fit' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
    const s = base * (tx.zoom || 1);
    const dw = iw * s, dh = ih * s;
    const ox = (dw - w) / 2, oy = (dh - h) / 2;
    /* pan only within the photo's overflow, so dragging can never pull
       the picture away from an edge and reveal the paper underneath */
    const cx = x + w / 2 + (tx.x || 0) * Math.max(ox, 0), cy = y + h / 2 + (tx.y || 0) * Math.max(oy, 0);
    out.ox = Math.max(ox, 0); out.oy = Math.max(oy, 0);
    const vx = Math.max(x, cx - dw / 2), vy = Math.max(y, cy - dh / 2);
    out.vis = { x: vx, y: vy, w: Math.min(x + w, cx + dw / 2) - vx, h: Math.min(y + h, cy + dh / 2) - vy };
    const rw = sideways ? dh : dw, rh = sideways ? dw : dh;
    ctx.save();
    ctx.filter = adjustFilter(adjust);
    ctx.translate(cx, cy);
    ctx.rotate(rot * Math.PI / 180);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im.img, -rw / 2, -rh / 2, rw, rh);
    ctx.restore();
    const tint = adjustTint(adjust);
    if (tint) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = tint; ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#d9dee6'); g.addColorStop(1, '#c3cbd8');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(60,70,90,0.45)';
    ctx.font = fontStr(Math.min(12, w / ppi * 22) / 72 * ppi, 'sans', 'normal', 'bold');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.label || 'Add a photograph', x + w / 2, y + h / 2);
  }
  ctx.restore();
  return out;
}

/* subtle blind-deboss hairline (fine-art mat) around a rect */
function drawMatHairline(ctx, x, y, w, h) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
  ctx.restore();
}

/* ═══════════════════════ Front renderer ═══════════════════════
   opts.hits (preview only) collects the on-card position of every editable
   piece of text, in inches from the card's top-left (bleed included), so the
   preview can offer click-to-edit right on the card. */
const photoOverflow = new WeakMap();   /* front → {x, y} pannable overflow in inches */

/* draw one line/paragraph of front text, record its hit box, return its height */
function frontText(ctx, R, key, text, x, y, o) {
  const { ppi, hit } = R;
  const sizePx = o.size;
  ctx.save();
  ctx.font = fontStr(sizePx, o.font, o.style, o.weight);
  if (o.ls) ctx.letterSpacing = `${o.ls * sizePx}px`;
  ctx.fillStyle = o.color;
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = sizePx * 0.3; }
  const lh = sizePx * (o.lh || 1.25);
  const maxW = o.maxW || 1e6;
  const lines = o.wrap ? wrapLines(ctx, text, maxW) : [text];
  const maxLines = o.maxLines || 99;
  const shown = lines.slice(0, maxLines);
  ctx.textBaseline = 'top';
  ctx.textAlign = o.align || 'left';
  let widest = 0;
  shown.forEach((ln, i) => { ctx.fillText(ln, x, y + i * lh); widest = Math.max(widest, ctx.measureText(ln).width); });
  ctx.restore();
  const h = shown.length * lh;
  const bw = o.wrap ? maxW : widest;
  const bx = o.align === 'center' ? x - bw / 2 : o.align === 'right' ? x - bw : x;
  if (hit && key) hit(key, bx, y, Math.max(bw, sizePx * 2), h, { font: o.font, style: o.style || 'normal', weight: o.weight || 'normal', sizeIn: sizePx / ppi, align: o.align || 'left', color: o.color, lh: o.lh || 1.25 });
  return h;
}
/* largest size (px) at which `text` fits maxW, capped at sizePx */
function fitSize(ctx, text, sizePx, maxW, font, style, weight, ls = 0) {
  ctx.save();
  ctx.font = fontStr(sizePx, font, style, weight);
  if (ls) ctx.letterSpacing = `${ls * sizePx}px`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w > maxW ? sizePx * maxW / w : sizePx;
}
function inkFor(bg) { return luminance(bg) > 0.55 ? '#1c1a17' : '#f7f4ee'; }
function softInkFor(bg) { return luminance(bg) > 0.55 ? 'rgba(28,26,23,0.62)' : 'rgba(247,244,238,0.72)'; }
function pt(v, ppi) { return v / 72 * ppi; }
/* placeholder only on screen */
function orHint(v, hint) { return v || (EXPORTING ? '' : hint); }

function drawFront(ctx, card, ppi, bleed, opts = {}) {
  const { w: tw, h: th } = trimSize();
  const W = (tw + bleed * 2) * ppi, H = (th + bleed * 2) * ppi;
  const f = card.front;
  const b = bleed * ppi;
  const hits = opts.hits || null;
  const R = {
    ppi, bleed, W, H, b, tw, th, opts, safe: SAFE_IN * ppi,
    hit: hits ? (key, x, y, w, h, extra) => hits.push({ key, x: x / ppi, y: y / ppi, w: w / ppi, h: h / ppi, ...extra }) : null,
  };
  const style = frontStyle(f);
  const special = FRONT_RENDERERS[style];
  if (special) {
    special(ctx, card, R);
    if (f.show.logo) drawFrontLogo(ctx, card, R, b + R.safe, true);
    return;
  }

  /* border / mat colour under everything */
  ctx.fillStyle = f.borderColor || '#ffffff';
  ctx.fillRect(0, 0, W, H);

  /* photo rect */
  const bw = f.borderW * ppi, bb = (f.borderW + f.borderBottom) * ppi;
  const noBorder = f.borderW <= 0.001 && f.borderBottom <= 0.001;
  const px = noBorder ? 0 : b + bw;
  const py = noBorder ? 0 : b + bw;
  const pw = noBorder ? W : W - 2 * (b + bw);
  const ph = noBorder ? H : H - (b + bw) - (b + bb);

  /* aspect-ratio crop snapping */
  let wx = px, wy = py, ww = pw, wh = ph;
  if (f.cropAspect && pw > 2 && ph > 2) {
    if (pw / ph > f.cropAspect) { ww = ph * f.cropAspect; wx = px + (pw - ww) / 2; }
    else { wh = pw / f.cropAspect; wy = py + (ph - wh) / 2; }
  }

  const im = imageStore.get(card.imageId);
  if (style === 'split-diptych' && ww > 2 && wh > 2) {
    const portrait = wh > ww;
    const gap = Math.max(3, f.borderW * ppi * 0.7);
    const im2 = card.imageId2 ? imageStore.get(card.imageId2) : null;
    let a, bR;
    if (portrait) { const hh = (wh - gap) / 2; a = [wx, wy, ww, hh]; bR = [wx, wy + hh + gap, ww, hh]; }
    else { const half = (ww - gap) / 2; a = [wx, wy, half, wh]; bR = [wx + half + gap, wy, half, wh]; }
    const ov = drawPhotoInto(ctx, im, { x: a[0], y: a[1], w: a[2], h: a[3], fit: f.fit, tx: f.tx, adjust: f.adjust, ppi });
    photoOverflow.set(f, { x: ov.ox / ppi, y: ov.oy / ppi });
    drawPhotoInto(ctx, im2, { x: bR[0], y: bR[1], w: bR[2], h: bR[3], fit: f.fit, tx: { x: 0, y: 0, zoom: 1, rot: 0 }, adjust: f.adjust, ppi, label: 'Add 2nd photo' });
  } else {
    const ov = drawPhotoInto(ctx, im, { x: wx, y: wy, w: ww, h: wh, fit: f.fit, tx: f.tx, adjust: f.adjust, ppi });
    photoOverflow.set(f, { x: ov.ox / ppi, y: ov.oy / ppi });
    if (f.matHairline && ww > 2 && wh > 2) {
      const v = ov.vis && ov.vis.w > 2 && ov.vis.h > 2 ? ov.vis : { x: wx, y: wy, w: ww, h: wh };
      drawMatHairline(ctx, v.x, v.y, v.w, v.h);
    }
  }
  if (R.hit) R.hit('photo', wx, wy, ww, wh);

  /* ── text on front ── */
  const light = luminance(f.borderColor) > 0.5;
  const inkOnBorder = light ? '#232323' : '#f4f4f2';
  const softOnBorder = light ? '#8a8a86' : 'rgba(244,244,242,0.72)';
  const leftAlign = style === 'museum-broadsheet';
  const m = card.meta;
  const safe = R.safe;

  /* Full-Bleed Modern: type sits in the corners over a soft scrim */
  if (f.overlayCorners && style === 'fullbleed-modern') {
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, 'rgba(8,10,14,0)'); g.addColorStop(1, 'rgba(8,10,14,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    const x0 = b + safe, bottom = H - b - safe;
    let y = bottom;
    const cap = f.show.caption ? orHint(applyTokens(m.caption.trim(), card), 'A short caption') : '';
    const title = f.show.title ? orHint(applyTokens(m.title.trim(), card), 'Photo Title') : '';
    const capPx = pt(7.5, ppi), titlePx = pt(17, ppi);
    if (cap) { y -= capPx * 1.3; frontText(ctx, R, 'caption', cap, x0, y, { size: capPx, font: 'sans', color: 'rgba(255,255,255,0.88)', maxW: W * 0.55, shadow: true }); }
    if (title) { y -= titlePx * 1.15; frontText(ctx, R, 'title', title, x0, y, { size: fitSize(ctx, title, titlePx, W * 0.6, 'editorial'), font: 'editorial', color: '#fff', shadow: true, lh: 1.1 }); }
    drawFrontCredit(ctx, card, R, W - b - safe, bottom - pt(6.2, ppi), 'right', 'rgba(255,255,255,0.9)', true);
    if (f.show.logo) drawFrontLogo(ctx, card, R, b + safe, true);
    return;
  }

  const bottomZoneTop = py + ph;
  const bottomZoneH = H - b - bottomZoneTop;
  const hasZone = bottomZoneH > 0.2 * ppi;
  const zx = b + Math.max(bw, safe * 0.8);
  const zw = W - 2 * zx;

  const big = style === 'museum-broadsheet';
  const capFont = f.captionStyle === 'script' ? 'script' : f.captionStyle === 'sans' ? 'sans' : 'editorial';
  const pieces = [];
  if (f.show.project && gv('project')) pieces.push({ text: gv('project').toUpperCase(), size: 6.5, font: 'sans', weight: 'bold', color: softOnBorder, ls: 0.12 });
  if (f.show.title) {
    const t = orHint(applyTokens(m.title.trim(), card), 'Photo Title');
    if (t) pieces.push({ key: 'title', text: t, size: big ? 16 : 13, font: 'editorial', color: inkOnBorder });
  }
  if (f.show.caption) {
    const c = orHint(applyTokens(m.caption.trim(), card), 'A short caption for this photograph.');
    if (c) pieces.push({ key: 'caption', text: c, size: capFont === 'script' ? 11 : capFont === 'editorial' ? 10 : 7.5, font: capFont, style: capFont === 'editorial' ? 'italic' : 'normal', color: light ? '#4c4c4a' : 'rgba(244,244,242,0.85)' });
  }
  if (style === 'museum-broadsheet') {
    const details = card.exif ? card.exif.settings : m.camera.trim();
    if (details) pieces.push({ text: details, size: 6.5, font: 'sans', color: softOnBorder, ls: 0.04 });
    if (m.edition.trim()) pieces.push({ text: m.edition.trim().toUpperCase(), size: 6, font: 'sans', weight: 'bold', color: softOnBorder, ls: 0.1 });
  }
  const smallBits = [];
  if (f.show.website && gv('website')) smallBits.push(gv('website'));
  if (f.show.copyright && gv('copyright')) smallBits.push(gv('copyright'));
  if (smallBits.length) pieces.push({ text: smallBits.join('   ·   '), size: 6, font: 'sans', color: softOnBorder });

  /* measure the stack; use the bottom border only if it fits */
  let metrics = null, totalH = 0;
  if (pieces.length && hasZone) {
    metrics = pieces.map(p => {
      const lh = p.size * 1.3 / 72 * ppi;
      ctx.font = fontStr(p.size / 72 * ppi, p.font, p.style, p.weight);
      const lines = wrapLines(ctx, p.text, zw);
      const h = lines.length * lh + p.size * 0.12 / 72 * ppi;
      totalH += h;
      return { lh, h };
    });
  }
  const zoneFits = metrics && totalH <= bottomZoneH - 0.03 * ppi;

  const creditInZone = f.creditPlace !== 'hidden' && f.creditPlace !== 'back' && !!creditText(card);
  const creditRoom = pt(6.2, ppi) * 2.2;
  const stackRoom = zoneFits && creditInZone && bottomZoneH - totalH >= creditRoom + 0.04 * ppi ? bottomZoneH - creditRoom : bottomZoneH;
  if (pieces.length && zoneFits) {
    let ty = bottomZoneTop + Math.max((stackRoom - totalH) / 2, 0.02 * ppi);
    pieces.forEach((p, i) => {
      const sizePx = p.size / 72 * ppi;
      frontText(ctx, R, p.key, p.text, leftAlign ? zx : zx + zw / 2, ty, {
        size: sizePx, font: p.font, style: p.style, weight: p.weight, color: p.color, ls: p.ls,
        align: leftAlign ? 'left' : 'center', wrap: true, maxW: zw, lh: 1.3,
      });
      ty += metrics[i].h;
    });
  } else if (pieces.length) {
    /* overlay on the photo with a soft scrim */
    const scrimH = Math.min(ph * 0.42, (pieces.length * 16 + 30) / 72 * ppi + safe);
    const g = ctx.createLinearGradient(0, py + ph - scrimH, 0, py + ph);
    g.addColorStop(0, 'rgba(8,10,14,0)'); g.addColorStop(1, 'rgba(8,10,14,0.62)');
    ctx.save();
    ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.fillStyle = g; ctx.fillRect(px, py + ph - scrimH, pw, scrimH);
    ctx.restore();
    let ty = py + ph - safe;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      const sizePx = p.size / 72 * ppi;
      const lh = sizePx * 1.3;
      ctx.font = fontStr(sizePx, p.font, p.style, p.weight);
      const lines = wrapLines(ctx, p.text, zw);
      ty -= lines.length * lh + sizePx * 0.3;
      frontText(ctx, R, p.key, p.text, leftAlign ? zx : zx + zw / 2, ty, {
        size: sizePx, font: p.font, style: p.style, weight: p.weight, color: '#ffffff', shadow: true,
        align: leftAlign ? 'left' : 'center', wrap: true, maxW: zw, lh: 1.3,
      });
    }
  }

  /* ── photographer credit ── */
  if (f.creditPlace !== 'hidden' && f.creditPlace !== 'back') {
    const sizePx = pt(6.2, ppi);
    let cx2, align;
    if (f.creditPlace === 'bottom-left') { cx2 = b + Math.max(bw, safe); align = 'left'; }
    else if (f.creditPlace === 'center') { cx2 = W / 2; align = 'center'; }
    else { cx2 = W - b - Math.max(bw, safe); align = 'right'; }
    const zoneEmpty = hasZone && (!pieces.length || !zoneFits);
    const zoneRoomBelow = hasZone && zoneFits && stackRoom < bottomZoneH;
    if (zoneEmpty) {
      drawFrontCredit(ctx, card, R, cx2, H - b - Math.max((bottomZoneH + sizePx) / 2, 0.05 * ppi + sizePx), align, light ? '#6a6a66' : 'rgba(244,244,242,0.8)');
    } else if (zoneRoomBelow) {
      drawFrontCredit(ctx, card, R, cx2, H - b - creditRoom / 2 - sizePx * 0.6, align, light ? '#8a8a86' : 'rgba(244,244,242,0.7)');
    } else {
      const xx = f.creditPlace === 'bottom-left' ? px + safe * 0.8 : f.creditPlace === 'center' ? px + pw / 2 : px + pw - safe * 0.8;
      drawFrontCredit(ctx, card, R, xx, py + ph - safe * 0.7 - sizePx, align, 'rgba(255,255,255,0.94)', true);
    }
  }

  if (f.show.logo) drawFrontLogo(ctx, card, R, b + Math.max(bw, safe), !hasZone);
}

function drawFrontCredit(ctx, card, R, x, y, align, color, shadow) {
  const f = card.front;
  if (f.creditPlace === 'hidden' || f.creditPlace === 'back') return;
  const text = creditText(card);
  if (!text) return;
  frontText(ctx, R, 'credit', text, x, y, { size: pt(6.2, R.ppi), font: 'sans', color, align, shadow });
}

function drawFrontLogo(ctx, card, R, inset, onPhoto) {
  const { ppi, W, opts } = R;
  const lg = state.global.logoId ? imageStore.get(state.global.logoId) : null;
  const lh = 0.24 * ppi;
  const ly = R.b + inset * 0.7 - R.b * 0.7;
  if (lg) {
    const s = Math.min(lh / lg.h, (lh * 2.4) / lg.w);
    ctx.drawImage(lg.img, W - inset - lg.w * s, ly, lg.w * s, lg.h * s);
  } else if (!opts.export) {
    const lx = W - inset - lh;
    ctx.save();
    ctx.strokeStyle = onPhoto ? 'rgba(255,255,255,0.8)' : 'rgba(120,120,116,0.8)';
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly, lh, lh);
    ctx.font = fontStr(pt(4.6, ppi), 'sans');
    ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LOGO', lx + lh / 2, ly + lh / 2);
    ctx.restore();
  }
}

/* ── Layouts that need their own drawing ── */
function photoFill(ctx, card, R, x, y, w, h, extra = {}) {
  const f = card.front;
  const ov = drawPhotoInto(ctx, imageStore.get(card.imageId), { x, y, w, h, fit: f.fit, tx: f.tx, adjust: extra.adjust || f.adjust, ppi: R.ppi });
  if (!extra.noRecord) photoOverflow.set(f, { x: ov.ox / R.ppi, y: ov.oy / R.ppi });
  if (R.hit && !extra.noRecord) R.hit('photo', x, y, w, h);
  return ov;
}

const FRONT_RENDERERS = {
  /* Big block letters filled with the photo, over a darkened copy of it */
  greetings(ctx, card, R) {
    const { ppi, W, H, b, th, safe } = R;
    const f = card.front, m = card.meta;
    const accent = f.accent || '#e8b931';
    const a0 = f.adjust || {};
    photoFill(ctx, card, R, 0, 0, W, H, { adjust: { ...a0, mode: 'bw', exposure: (a0.exposure ?? 1) * 0.9 } });
    ctx.fillStyle = 'rgba(14,12,9,0.5)'; ctx.fillRect(0, 0, W, H);

    const word = orHint((m.location.trim() || m.title.trim()).toUpperCase(), 'YOUR PLACE');
    const tagline = f.tagline != null ? f.tagline : 'Greetings from';
    const maxW = W - 2 * (b + safe * 1.2);
    let size = th * 0.5 * ppi;
    size = fitSize(ctx, word, size, maxW, 'display', 'normal', 'normal', 0.02);
    ctx.font = fontStr(size, 'display');
    ctx.letterSpacing = `${0.02 * size}px`;
    const mt = ctx.measureText(word || 'X');
    const asc = mt.actualBoundingBoxAscent || size * 0.75, desc = mt.actualBoundingBoxDescent || 0;
    const tagPx = Math.max(pt(12, ppi), size * 0.2);
    const blockH = tagPx * 1.1 + asc + desc;
    const top = (H - blockH) / 2 + tagPx * 0.3;
    const base = top + tagPx * 1.1 + asc;
    const cx = W / 2;
    if (word) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      /* extruded shadow */
      const depth = Math.max(2, size * 0.055);
      ctx.fillStyle = '#14110d';
      for (let k = depth; k > 0; k -= Math.max(1, depth / 14)) ctx.fillText(word, cx + k, base + k);
      /* accent outline */
      ctx.lineJoin = 'round';
      ctx.strokeStyle = accent; ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.strokeText(word, cx, base);
      /* letters filled with the photo */
      const off = document.createElement('canvas');
      off.width = Math.ceil(W); off.height = Math.ceil(H);
      const o = off.getContext('2d');
      const a = f.adjust || {};
      drawPhotoInto(o, imageStore.get(card.imageId), { x: 0, y: 0, w: W, h: H, fit: 'fill', tx: f.tx, adjust: { ...a, exposure: (a.exposure ?? 1) * 1.22, contrast: (a.contrast ?? 1) * 1.1 }, ppi });
      o.globalCompositeOperation = 'destination-in';
      o.font = ctx.font; o.letterSpacing = ctx.letterSpacing;
      o.textAlign = 'center'; o.textBaseline = 'alphabetic';
      o.fillText(word, cx, base);
      ctx.drawImage(off, 0, 0);
      ctx.strokeStyle = 'rgba(20,17,13,0.85)'; ctx.lineWidth = Math.max(1, size * 0.012);
      ctx.strokeText(word, cx, base);
      ctx.letterSpacing = '0px';
      const ww = Math.min(maxW, ctx.measureText(word).width);
      if (R.hit) R.hit('location', cx - ww / 2, base - asc, ww, asc + desc, { font: 'display', sizeIn: size / ppi, align: 'center', color: '#fff', lh: 1 });
    }
    ctx.letterSpacing = '0px';
    if (tagline) frontText(ctx, R, 'tagline', tagline, cx, top - tagPx * 0.15, { size: tagPx, font: 'editorial', style: 'italic', color: accent, align: 'center', shadow: true, lh: 1.05 });
    else if (R.hit && !EXPORTING) R.hit('tagline', cx - tagPx * 3, top - tagPx * 0.15, tagPx * 6, tagPx, { font: 'editorial', style: 'italic', sizeIn: tagPx / ppi, align: 'center', color: accent });
    drawFrontCredit(ctx, card, R, W - b - safe, H - b - safe * 0.8 - pt(6.2, ppi), 'right', 'rgba(255,255,255,0.85)');
  },

  /* Inset photo over a solid band carrying the title in poster type */
  'travel-poster'(ctx, card, R) {
    const { ppi, W, H, b, th, safe } = R;
    const f = card.front, m = card.meta;
    const accent = f.accent || '#1f4e5f';
    const ink = inkFor(accent), soft = softInkFor(accent);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, H);
    const bd = b + Math.max(f.borderW, 0.1) * ppi;
    const bandH = th * 0.3 * ppi;
    const photoB = H - b - bandH;
    photoFill(ctx, card, R, bd, bd, W - 2 * bd, photoB - bd);
    const title = f.show.title ? orHint(applyTokens(m.title.trim(), card).toUpperCase(), 'PHOTO TITLE') : '';
    const right = [m.location.trim(), m.date.trim()].filter(Boolean).join('\n') || (EXPORTING ? '' : 'YOUR PLACE\n2026');
    const colW = (W - 2 * bd) * (right ? 0.66 : 0.95);
    const capH = f.show.caption ? pt(7, ppi) * 1.5 : 0;
    let ts = fitSize(ctx, title, bandH * 0.56, colW, 'display', 'normal', 'normal', 0.03);
    const ty = photoB + (bandH - ts * 1.02 - capH) / 2;
    if (title) frontText(ctx, R, 'title', title, bd, ty, { size: ts, font: 'display', color: ink, ls: 0.03, lh: 1.02 });
    if (f.show.caption) {
      const c = orHint(applyTokens(m.caption.trim(), card), 'A short caption');
      if (c) frontText(ctx, R, 'caption', c, bd, ty + ts * 1.06, { size: pt(7, ppi), font: 'sans', color: soft, maxW: colW, maxLines: 1, wrap: true });
    }
    if (right) {
      const rs = pt(6.5, ppi);
      const lines = right.split('\n');
      const ry = photoB + (bandH - lines.length * rs * 1.5) / 2;
      frontText(ctx, R, 'location', right.toUpperCase(), W - bd, ry, { size: rs, font: 'sans', weight: 'bold', color: soft, align: 'right', ls: 0.16, wrap: true, maxW: (W - 2 * bd) * 0.3, lh: 1.5 });
    }
    ctx.fillStyle = soft; ctx.fillRect(bd, photoB + Math.max(1, ppi / 150), W - 2 * bd, Math.max(1, ppi / 200));
  },

  /* A single 35 mm frame with sprocket holes and amber edge print */
  'film-strip'(ctx, card, R) {
    const { ppi, W, H, b, th, safe } = R;
    const m = card.meta;
    ctx.fillStyle = '#0e0d0c'; ctx.fillRect(0, 0, W, H);
    const strip = th * 0.13 * ppi;
    const holeW = strip * 0.5, holeH = strip * 0.38, pitch = holeW * 1.85;
    const rr = holeH * 0.22;
    ctx.fillStyle = '#efebe3';
    const hole = (x, y) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, holeW, holeH, rr) : ctx.rect(x, y, holeW, holeH); ctx.fill(); };
    const topY = b + strip * 0.16, botY = H - b - strip * 0.16 - holeH;
    for (let x = (W % pitch) / 2 - pitch; x < W; x += pitch) { hole(x, topY); hole(x, botY); }
    const fx = b + safe * 0.5, fy = b + strip, fw = W - 2 * fx, fh = H - 2 * (b + strip);
    ctx.save();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(fx, fy, fw, fh, ppi * 0.03) : ctx.rect(fx, fy, fw, fh); ctx.clip();
    photoFill(ctx, card, R, fx, fy, fw, fh);
    ctx.restore();
    const amber = '#e9a03b';
    const ep = pt(5.2, ppi);
    const n = Math.max(1, state.cards.indexOf(card) + 1);
    const titleText = card.front.show.title ? orHint(m.title.trim().toUpperCase(), 'PHOTO TITLE') : '';
    const lowerTop = topY + holeH + (fy - topY - holeH - ep) / 2;
    frontText(ctx, R, null, `▸ ${n}`, fx + pitch * 0.2, lowerTop, { size: ep, font: 'mono', weight: 'bold', color: amber, ls: 0.1 });
    if (titleText) frontText(ctx, R, 'title', titleText, W / 2, lowerTop, { size: ep, font: 'mono', weight: 'bold', color: amber, align: 'center', ls: 0.22 });
    frontText(ctx, R, null, `${n}A`, W - fx - pitch * 0.2, lowerTop, { size: ep, font: 'mono', weight: 'bold', color: amber, align: 'right', ls: 0.1 });
    const bottomText = orHint([m.location.trim(), m.date.trim()].filter(Boolean).join('  ·  ').toUpperCase(), 'YOUR PLACE  ·  2026');
    const upperBot = fy + fh + (botY - fy - fh - ep) / 2;
    if (bottomText) frontText(ctx, R, 'location', bottomText, W / 2, upperBot, { size: ep, font: 'mono', weight: 'bold', color: amber, align: 'center', ls: 0.22 });
    frontText(ctx, R, null, `${n + 1}`, fx + pitch * 0.2, upperBot, { size: ep, font: 'mono', weight: 'bold', color: amber, ls: 0.1 });
  },

  /* The whole front is one oversized perforated stamp, with a cancellation */
  'postage-stamp'(ctx, card, R) {
    const { ppi, W, H, b, tw, th } = R;
    const f = card.front, m = card.meta;
    const bg = f.accent || '#e9e3d6';
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const sw = Math.min(tw * 0.72, th * 1.18) * ppi, sh = th * 0.78 * ppi;
    const sx = (W - sw) / 2 - tw * 0.04 * ppi, sy = (H - sh) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = ppi * 0.05; ctx.shadowOffsetY = ppi * 0.015;
    ctx.fillStyle = '#fbf9f4'; ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
    perforate(ctx, { x: sx, y: sy, w: sw, h: sh }, ppi, bg, 0.11);
    const pad = 0.17 * ppi, labelH = 0.3 * ppi;
    const px = sx + pad, py = sy + pad, pw = sw - 2 * pad, ph = sh - 2 * pad - labelH;
    photoFill(ctx, card, R, px, py, pw, ph);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, ppi / 300);
    ctx.strokeRect(px, py, pw, ph);
    const lp = pt(7, ppi);
    const ly = py + ph + (labelH - lp) / 2;
    const place = orHint(m.location.trim().toUpperCase(), 'YOUR PLACE');
    if (place) frontText(ctx, R, 'location', place, px, ly, { size: lp, font: 'sans', weight: 'bold', color: '#2a2622', ls: 0.14 });
    const date = orHint(m.date.trim(), '2026');
    if (date) frontText(ctx, R, 'date', date, px + pw, ly - lp * 0.25, { size: lp * 1.3, font: 'editorial', style: 'italic', color: '#2a2622', align: 'right' });
    if (f.cancel !== false) {
      const r = { x: sx + sw * 0.7, y: sy - sh * 0.05, w: tw * 0.4 * ppi, h: th * 0.27 * ppi };
      drawPostmark(ctx, card, { ink: '#2b2b2b', opacity: 0.62, blend: 'multiply', waves: 5, city: null, date: null }, r, ppi);
    }
  },

  /* Edge-to-edge photo with a solid band for the title */
  'caption-bar'(ctx, card, R) {
    const { ppi, W, H, b, th, safe } = R;
    const f = card.front, m = card.meta;
    const accent = f.accent || '#151515';
    const ink = inkFor(accent), soft = softInkFor(accent);
    const barH = Math.max(0.5, th * 0.16) * ppi;
    const barY = H - b - barH;
    photoFill(ctx, card, R, 0, 0, W, barY);
    ctx.fillStyle = accent; ctx.fillRect(0, barY, W, H - barY);
    const x0 = b + safe;
    const right = orHint([m.location.trim(), m.date.trim()].filter(Boolean).join('  ·  ').toUpperCase(), 'YOUR PLACE  ·  2026');
    const rp = pt(6.5, ppi);
    let rw = 0;
    if (right) { ctx.font = fontStr(rp, 'sans', 'normal', 'bold'); ctx.letterSpacing = `${0.14 * rp}px`; rw = ctx.measureText(right).width; ctx.letterSpacing = '0px'; }
    const title = f.show.title ? orHint(applyTokens(m.title.trim(), card), 'Photo Title') : '';
    if (title) {
      const ts = fitSize(ctx, title, barH * 0.56, W - 2 * x0 - rw - safe, 'editorial');
      frontText(ctx, R, 'title', title, x0, barY + (barH - ts) / 2 - ts * 0.05, { size: ts, font: 'editorial', color: ink, lh: 1 });
    }
    if (right) frontText(ctx, R, 'location', right, W - x0, barY + (barH - rp) / 2, { size: rp, font: 'sans', weight: 'bold', color: soft, align: 'right', ls: 0.14 });
    drawFrontCredit(ctx, card, R, W - x0, barY - safe * 0.6 - pt(6.2, ppi), 'right', 'rgba(255,255,255,0.9)', true);
  },

  /* Magazine page: headline column and a large photo */
  'editorial-cover'(ctx, card, R) {
    const { ppi, W, H, b, tw, th, safe } = R;
    const f = card.front, m = card.meta;
    const bg = f.accent || '#f4efe4';
    const ink = inkFor(bg), soft = softInkFor(bg);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const mg = b + Math.max(f.borderW, 0.16) * ppi;
    const landscape = tw >= th * 1.05;
    let col, photo;
    if (landscape) {
      const px = W * 0.43;
      photo = [px, mg, W - mg - px, H - 2 * mg];
      col = { x: mg, y: mg, w: px - mg - safe * 0.9, h: H - 2 * mg };
    } else {
      const py = H * 0.42;
      photo = [mg, py, W - 2 * mg, H - mg - py];
      col = { x: mg, y: mg, w: W - 2 * mg, h: py - mg - safe * 0.6 };
    }
    photoFill(ctx, card, R, ...photo);
    const n = Math.max(1, state.cards.indexOf(card) + 1);
    const np = pt(6.5, ppi);
    frontText(ctx, R, null, `No. ${String(n).padStart(2, '0')}`, col.x, col.y, { size: np, font: 'mono', color: soft, ls: 0.06 });
    if (gv('project')) {
      const pj = gv('project').toUpperCase();
      frontText(ctx, R, null, pj, col.x + col.w, col.y, { size: fitSize(ctx, pj, np, col.w * 0.66, 'sans', 'normal', 'bold', 0.12), font: 'sans', weight: 'bold', color: soft, align: 'right', ls: 0.12 });
    }
    let y = col.y + np * 2.6;
    const title = f.show.title ? orHint(applyTokens(m.title.trim(), card), 'Photo Title') : '';
    if (title) {
      let ts = Math.min(th * 0.2 * ppi, col.w * 0.34);
      ctx.font = fontStr(ts, 'editorial');
      while (ts > pt(12, ppi) && wrapLines(ctx, title, col.w).length * ts * 0.98 > col.h * 0.55) { ts *= 0.92; ctx.font = fontStr(ts, 'editorial'); }
      y += frontText(ctx, R, 'title', title, col.x, y, { size: ts, font: 'editorial', color: ink, wrap: true, maxW: col.w, lh: 0.98, maxLines: 4 }) + ts * 0.25;
    }
    if (f.show.caption) {
      const c = orHint(applyTokens(m.caption.trim(), card), 'A short caption for this photograph.');
      if (c) frontText(ctx, R, 'caption', c, col.x, y, { size: pt(7.5, ppi), font: 'sans', color: soft, wrap: true, maxW: col.w, lh: 1.4, maxLines: 4 });
    }
    const foot = orHint([m.location.trim(), m.date.trim()].filter(Boolean).join('  ·  ').toUpperCase(), 'YOUR PLACE  ·  2026');
    const fp = pt(6, ppi);
    const fy = col.y + col.h - fp;
    ctx.fillStyle = soft; ctx.fillRect(col.x, fy - fp * 0.9, Math.min(col.w, ppi * 0.5), Math.max(1, ppi / 200));
    if (foot) frontText(ctx, R, 'location', foot, col.x, fy, { size: fp, font: 'sans', weight: 'bold', color: soft, ls: 0.14, wrap: true, maxW: col.w, maxLines: 1 });
  },

  /* Large centred words over the photo — greetings, announcements */
  headline(ctx, card, R) {
    const { ppi, W, H, b, tw, th, safe } = R;
    const f = card.front, m = card.meta;
    photoFill(ctx, card, R, 0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(10,9,8,0.42)'); g.addColorStop(1, 'rgba(10,9,8,0.18)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const title = f.show.title ? orHint(applyTokens(m.title.trim(), card), 'Season’s Greetings') : '';
    const cap = f.show.caption ? orHint(applyTokens(m.caption.trim(), card).toUpperCase(), 'FROM ALL OF US') : '';
    const maxW = W - 2 * (b + safe * 1.6);
    let ts = th * 0.24 * ppi;
    ctx.font = fontStr(ts, 'editorial');
    while (ts > pt(14, ppi) && (wrapLines(ctx, title, maxW).length > 2 || Math.max(...wrapLines(ctx, title, maxW).map(l => ctx.measureText(l).width)) > maxW)) { ts *= 0.93; ctx.font = fontStr(ts, 'editorial'); }
    const lines = title ? Math.min(2, wrapLines(ctx, title, maxW).length) : 0;
    const cp = pt(7.5, ppi);
    const blockH = lines * ts * 1.0 + (cap ? cp * 2.4 : 0);
    let y = (H - blockH) / 2;
    if (title) y += frontText(ctx, R, 'title', title, W / 2, y, { size: ts, font: 'editorial', color: '#fff', align: 'center', wrap: true, maxW, lh: 1.0, maxLines: 2, shadow: true });
    if (cap) frontText(ctx, R, 'caption', cap, W / 2, y + cp * 1.1, { size: cp, font: 'sans', weight: 'bold', color: 'rgba(255,255,255,0.88)', align: 'center', ls: 0.22, shadow: true });
    drawFrontCredit(ctx, card, R, W - b - safe, H - b - safe * 0.8 - pt(6.2, ppi), 'right', 'rgba(255,255,255,0.85)', true);
  },
};

/* ═══════════════════════ Back renderer ═══════════════════════ */
function elementRect(el, ppi, bleed) {
  const { w: tw, h: th } = trimSize();
  const b = bleed * ppi;
  return {
    x: b + el.x * tw * ppi,
    y: b + el.y * th * ppi,
    w: el.w * tw * ppi,
    h: el.h * th * ppi,
  };
}

function drawBack(ctx, card, ppi, bleed, opts = {}) {
  const { w: tw, h: th } = trimSize();
  const W = (tw + bleed * 2) * ppi, H = (th + bleed * 2) * ppi;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const back = card.back;
  for (const el of back.elements) {
    if (!el.visible) continue;
    const r = elementRect(el, ppi, bleed);
    drawBackElement(ctx, card, el, r, ppi, opts);
  }

  /* credit routed to the back */
  if (card.front.creditPlace === 'back' && !back.elements.some(e => e.bind === 'credit' && e.visible)) {
    ctx.fillStyle = '#7a7a7a';
    ctx.font = fontStr(6.5 / 72 * ppi, 'sans');
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(creditText(card), bleed * ppi + 0.2 * ppi, H - bleed * ppi - 0.14 * ppi);
  }

  /* selection chrome (preview only) */
  if (opts.selected) {
    const r = elementRect(opts.selected, ppi, bleed);
    ctx.save();
    ctx.strokeStyle = '#c23b22'; ctx.lineWidth = Math.max(1.2, ppi / 72);
    ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    const hs = Math.max(9, ppi * 0.1);
    ctx.fillStyle = '#c23b22';
    ctx.beginPath(); ctx.arc(r.x + r.w, r.y + r.h, hs / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(r.x + r.w, r.y + r.h, hs / 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* ═══════════════════ Postmark & stamp generators ═══════════════════ */
const POSTMARK_INKS = [
  { id: 'slate', label: 'Slate', color: '#3b4a56' },
  { id: 'black', label: 'Black', color: '#1a1a1a' },
  { id: 'red',   label: 'Faded red', color: '#9e4038' },
];

/* draw text along a circular arc (degrees; canvas 0°=right, 90°=down) */
function circText(ctx, text, cx, cy, radius, startDeg, endDeg, fontPx, bottom) {
  const chars = [...text.toUpperCase()];
  const n = chars.length;
  if (!n) return;
  ctx.textAlign = 'center'; ctx.textBaseline = bottom ? 'top' : 'bottom';
  ctx.font = `700 ${fontPx}px ${FONTS.sans}`;
  const a0 = startDeg * Math.PI / 180, a1 = endDeg * Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ang = a0 + (a1 - a0) * t;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.rotate(ang + (bottom ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }
}

function drawPostmark(ctx, card, el, r, ppi) {
  const ink = el.ink || '#3b4a56';
  const city = (el.city != null ? el.city : card.meta.location).trim() || (EXPORTING ? '' : 'YOUR LOCATION');
  const date = (el.date != null ? el.date : card.meta.date).trim() || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const circleD = Math.min(r.h, r.w * 0.55);
  const cx = r.x + circleD / 2, cy = r.y + r.h / 2;
  const R = circleD * 0.46;
  ctx.save();
  ctx.globalAlpha = el.opacity != null ? el.opacity : 0.85;
  if (el.blend === 'multiply') ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(1, R * 0.05);
  /* rings */
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2); ctx.stroke();
  /* arced city (top) and date (bottom) text */
  const tr = R * 0.88;
  circText(ctx, city, cx, cy, tr, -168, -12, R * 0.2, false);
  circText(ctx, date, cx, cy, tr, 168, 12, R * 0.18, true);
  /* centre star */
  ctx.fillStyle = ink;
  ctx.font = `700 ${R * 0.22}px ${FONTS.serif}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', cx, cy);
  /* wavy cancellation lines to the right of the ring */
  const wx0 = cx + R * 1.05, wx1 = r.x + r.w;
  if (wx1 - wx0 > R * 0.5) {
    const lines = el.waves || 5;
    const amp = (r.h * 0.5) / (lines + 1) * 0.5;
    ctx.lineWidth = Math.max(1, R * 0.045);
    for (let l = 0; l < lines; l++) {
      const ly = cy - (r.h * 0.36) + l * (r.h * 0.72 / (lines - 1 || 1));
      ctx.beginPath();
      for (let px = wx0; px <= wx1; px += Math.max(2, R * 0.06)) {
        const yy = ly + Math.sin((px - wx0) / (R * 0.32)) * amp;
        px === wx0 ? ctx.moveTo(px, yy) : ctx.lineTo(px, yy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* perforated-edge helper: punch semicircular notches around a rect */
function perforate(ctx, r, ppi, bg, stepIn) {
  const step = stepIn ? stepIn * ppi : Math.max(6, Math.min(r.w, r.h) / 11);
  ctx.save();
  ctx.fillStyle = bg;
  ctx.globalCompositeOperation = 'source-over';
  const punch = (x, y) => { ctx.beginPath(); ctx.arc(x, y, step * 0.42, 0, Math.PI * 2); ctx.fill(); };
  for (let x = r.x; x <= r.x + r.w + 0.1; x += step) { punch(x, r.y); punch(x, r.y + r.h); }
  for (let y = r.y; y <= r.y + r.h + 0.1; y += step) { punch(r.x, y); punch(r.x + r.w, y); }
  ctx.restore();
}

function drawVintageStamp(ctx, card, el, r, ppi) {
  ctx.save();
  /* stamp body */
  ctx.fillStyle = el.stampColor || '#f7f2e6';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  /* perforations punched in the surrounding background colour */
  perforate(ctx, r, ppi, '#ffffff');
  /* inner frame + motif */
  const pad = Math.min(r.w, r.h) * 0.13;
  ctx.strokeStyle = el.ink || '#7a6f57';
  ctx.lineWidth = Math.max(1, ppi / 260);
  ctx.strokeRect(r.x + pad, r.y + pad, r.w - 2 * pad, r.h - 2 * pad);
  ctx.strokeStyle = 'rgba(122,111,87,0.5)';
  ctx.strokeRect(r.x + pad * 1.5, r.y + pad * 1.5, r.w - 3 * pad, r.h - 3 * pad);
  ctx.fillStyle = el.ink || '#7a6f57';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.min(r.w, r.h) * 0.14}px ${FONTS.serif}`;
  ctx.fillText('✶', r.x + r.w / 2, r.y + r.h * 0.42);
  ctx.font = `700 ${Math.min(r.w, r.h) * 0.1}px ${FONTS.sans}`;
  ctx.fillText('POSTCARD', r.x + r.w / 2, r.y + r.h * 0.68);
  ctx.restore();
}

function drawStampImage(ctx, im, r, ppi) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const s = Math.max(r.w / im.w, r.h / im.h);
  const dw = im.w * s, dh = im.h * s;
  ctx.drawImage(im.img, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
  ctx.restore();
  perforate(ctx, r, ppi, '#ffffff');
  ctx.restore();
}

function drawBackElement(ctx, card, el, r, ppi, opts) {
  ctx.save();
  switch (el.type) {
    case 'stamp': {
      const style = el.stampStyle || 'placeholder';
      if (style === 'image' && el.stampImageId && imageStore.get(el.stampImageId)) {
        drawStampImage(ctx, imageStore.get(el.stampImageId), r, ppi);
      } else if (style === 'vintage') {
        drawVintageStamp(ctx, card, el, r, ppi);
      } else {
        ctx.strokeStyle = '#b9b9b4';
        ctx.lineWidth = Math.max(1, ppi / 200);
        ctx.setLineDash([ppi * 0.026, ppi * 0.02]);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#b9b9b4';
        ctx.font = fontStr(4.6 / 72 * ppi, 'sans', 'normal', 'bold');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lh = 5.6 / 72 * ppi;
        ctx.letterSpacing = `${0.6 / 72 * ppi}px`;
        ctx.fillText('PLACE', r.x + r.w / 2, r.y + r.h / 2 - lh);
        ctx.fillText('STAMP', r.x + r.w / 2, r.y + r.h / 2);
        ctx.fillText('HERE', r.x + r.w / 2, r.y + r.h / 2 + lh);
        ctx.letterSpacing = '0px';
      }
      break;
    }
    case 'postmark': {
      drawPostmark(ctx, card, el, r, ppi);
      break;
    }
    case 'address': {
      const n = 4;
      ctx.strokeStyle = '#c9c9c4';
      ctx.lineWidth = Math.max(1, ppi / 240);
      for (let i = 1; i <= n; i++) {
        const y = r.y + (r.h * i) / n;
        ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
      }
      if (!opts.export && el.showLabel !== false) {
        ctx.fillStyle = 'rgba(150,150,146,0.55)';
        ctx.font = fontStr(5.5 / 72 * ppi, 'sans');
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText('Address', r.x, r.y + r.h / n - 2.4 / 72 * ppi);
      }
      break;
    }
    case 'lines': {
      const n = Math.max(1, el.lines || 6);
      ctx.strokeStyle = el.color && el.color !== '#2a2a2a' ? el.color : '#cfc9bd';
      ctx.lineWidth = Math.max(1, ppi / 260);
      for (let i = 1; i <= n; i++) {
        const y = Math.round(r.y + (r.h * i) / n) + 0.5;
        ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
      }
      break;
    }
    case 'divider': {
      ctx.fillStyle = el.color && el.color !== '#2a2a2a' ? el.color : '#cfcfca';
      ctx.fillRect(r.x, r.y, Math.max(r.w, ppi / 220), Math.max(r.h, ppi / 220));
      break;
    }
    case 'airmail': {
      /* classic red/blue airmail chevrons: slanted dashes walking the border ring */
      const band = Math.max(4, Math.min(r.w, r.h) * 0.028);
      const seg = band * 1.5;
      ctx.save();
      /* clip to the ring so slanted dashes never bleed inward */
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.rect(r.x + band, r.y + band, r.w - 2 * band, r.h - 2 * band);
      ctx.clip('evenodd');
      const per = 2 * ((r.w - band) + (r.h - band));
      const dash = (cx, cy, nx, ny, idx) => {
        /* a parallelogram slanted along travel direction (nx,ny) */
        ctx.fillStyle = idx % 2 ? '#c0392b' : '#22468f';
        const tx = nx, ty = ny;            /* travel */
        const px = -ny, py = nx;           /* perpendicular (into band) */
        const a = seg * 0.55, sk = band * 0.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + tx * a, cy + ty * a);
        ctx.lineTo(cx + tx * a + px * band - tx * sk, cy + ty * a + py * band - ty * sk);
        ctx.lineTo(cx + px * band - tx * sk, cy + py * band - ty * sk);
        ctx.closePath(); ctx.fill();
      };
      let idx = 0;
      for (let x = r.x; x < r.x + r.w - band; x += seg) dash(x, r.y, 1, 0, idx++);          /* top */
      for (let y = r.y; y < r.y + r.h - band; y += seg) dash(r.x + r.w, y, 0, 1, idx++);       /* right */
      for (let x = r.x + r.w; x > r.x + band; x -= seg) dash(x, r.y + r.h, -1, 0, idx++);       /* bottom */
      for (let y = r.y + r.h; y > r.y + band; y -= seg) dash(r.x, y, 0, -1, idx++);          /* left */
      ctx.restore();
      break;
    }
    case 'box': {
      const label = el.label || '';
      const dashed = el.dashed;
      ctx.strokeStyle = el.color && el.color !== '#2a2a2a' ? el.color : '#b9b9b4';
      ctx.lineWidth = Math.max(1, ppi / 260);
      if (dashed) ctx.setLineDash([ppi * 0.02, ppi * 0.015]);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]);
      const value = el.bind ? applyTokens(bindText(card, el.bind), card) : el.text;
      const labelPx = 5.4 / 72 * ppi;
      if (label) {
        ctx.fillStyle = '#9a9a94';
        ctx.font = fontStr(labelPx, 'sans', 'normal', 'bold');
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.letterSpacing = `${0.5 / 72 * ppi}px`;
        ctx.fillText(label, r.x + labelPx * 0.6, r.y + labelPx * 0.6);
        ctx.letterSpacing = '0px';
      }
      if (value || (!opts.export && el.bind && BIND_PLACEHOLDER[el.bind])) {
        const shown = value || BIND_PLACEHOLDER[el.bind];
        const sizePx = (el.size || 8) / 72 * ppi;
        ctx.fillStyle = value ? (el.color && el.color !== '#2a2a2a' ? el.color : '#2a2a2a') : 'rgba(150,150,146,0.7)';
        ctx.font = fontStr(sizePx, el.font || 'sans', 'normal', 'normal');
        drawWrapped(ctx, shown, r.x + labelPx * 0.6, r.y + (label ? labelPx * 2 : labelPx), r.w - labelPx * 1.2, sizePx * 1.4, el.align || 'left', r.h - labelPx * 2);
      }
      break;
    }
    case 'qr': {
      const t = card.back.qrText || state.global.website;
      if (opts.export && !(t || '').trim()) break;   /* never print an empty QR placeholder */
      drawQr(ctx, t, r.x, r.y, Math.min(r.w, r.h), { dark: el.qrDark || '#1a1a1a', light: el.qrLight || '#ffffff' });
      break;
    }
    case 'logo': {
      const lg = state.global.logoId ? imageStore.get(state.global.logoId) : null;
      if (lg) {
        const s = Math.min(r.w / lg.w, r.h / lg.h);
        ctx.drawImage(lg.img, r.x, r.y, lg.w * s, lg.h * s);
      } else if (!opts.export) {
        ctx.strokeStyle = '#c9c9c4'; ctx.setLineDash([3, 3]);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#b0b0ab';
        ctx.font = fontStr(5 / 72 * ppi, 'sans');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LOGO', r.x + r.w / 2, r.y + r.h / 2);
      }
      break;
    }
    default: { /* text */
      let text = el.bind ? bindText(card, el.bind) : applyTokens(el.text, card);
      let ghost = false;
      if (!text && !opts.export && el.bind && BIND_PLACEHOLDER[el.bind]) {
        text = BIND_PLACEHOLDER[el.bind]; ghost = true;
      } else if (text && !opts.export && el.bind && !bindTextReal(card, el.bind)) {
        ghost = true;   /* a hint such as "Your Website": shown faintly, never printed */
      }
      if (!text) break;
      const sizePx = el.size / 72 * ppi;
      ctx.font = fontStr(sizePx, el.font, el.style, el.weight);
      ctx.fillStyle = ghost ? 'rgba(150,150,146,0.6)' : el.color;
      if (el.letterSpacing) ctx.letterSpacing = `${el.letterSpacing * sizePx}px`;
      drawWrapped(ctx, text, r.x, r.y, r.w, sizePx * el.lineHeight, el.align, r.h + sizePx * 0.6);
      ctx.letterSpacing = '0px';
    }
  }
  ctx.restore();
}

/* ═══════════════════ Marks, guides, card canvas ═══════════════════ */
function drawCropMarks(ctx, ppi, slug, bleed) {
  const { w: tw, h: th } = trimSize();
  const W = (tw + 2 * bleed + 2 * slug) * ppi, H = (th + 2 * bleed + 2 * slug) * ppi;
  const t0 = (slug + bleed) * ppi;                    /* trim origin */
  const t1w = t0 + tw * ppi, t1h = t0 + th * ppi;
  const g = MARK_GAP * ppi, L = MARK_LEN * ppi;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, ppi / 300);
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  for (const x of [t0, t1w]) {
    line(x, t0 - bleed * ppi - g, x, t0 - bleed * ppi - g - L);          /* top */
    line(x, t1h + bleed * ppi + g, x, t1h + bleed * ppi + g + L);        /* bottom */
  }
  for (const y of [t0, t1h]) {
    line(t0 - bleed * ppi - g, y, t0 - bleed * ppi - g - L, y);          /* left */
    line(t1w + bleed * ppi + g, y, t1w + bleed * ppi + g + L, y);        /* right */
  }
  ctx.restore();
}

/* Render one side of one card to a canvas.
   opts: { bleed, marks, guides, selected, export } */
function renderCardSide(card, side, ppi, opts = {}) {
  const { w: tw, h: th } = trimSize();
  const bleed = opts.bleed ? BLEED_IN : 0;
  const slug = opts.marks ? MARK_LEN + MARK_GAP + 0.02 : 0;
  const W = Math.round((tw + 2 * bleed + 2 * slug) * ppi);
  const H = Math.round((th + 2 * bleed + 2 * slug) * ppi);
  const canvas = opts.target || document.createElement('canvas');
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.clearRect(0, 0, W, H);
  if (slug) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(slug * ppi, slug * ppi);
  }
  const prev = EXPORTING;
  EXPORTING = !!opts.export;
  try {
    if (side === 'front') drawFront(ctx, card, ppi, bleed, opts);
    else drawBack(ctx, card, ppi, bleed, opts);
  } finally { EXPORTING = prev; }
  if (slug) { ctx.restore(); drawCropMarks(ctx, ppi, slug, bleed); }
  return canvas;
}

/* ═══════════════════ Sheet imposition ═══════════════════ */
function sheetLayout(sheetKey, opts = {}) {
  const sheet = SHEETS[sheetKey];
  const bleed = opts.bleed ? BLEED_IN : 0;
  const { w: tw, h: th } = trimSize();
  const cw = tw + 2 * bleed, ch = th + 2 * bleed;
  const margin = 0.4, gap = opts.marks ? 0.42 : 0.18;
  const fits = (W, H) => ({
    cols: Math.max(0, Math.floor((W - 2 * margin + gap) / (cw + gap))),
    rows: Math.max(0, Math.floor((H - 2 * margin + gap) / (ch + gap))),
  });
  /* try portrait and landscape sheet, keep the one that fits more cards */
  const p = fits(sheet.w, sheet.h), l = fits(sheet.h, sheet.w);
  const usePortrait = p.cols * p.rows >= l.cols * l.rows;
  const W = usePortrait ? sheet.w : sheet.h, H = usePortrait ? sheet.h : sheet.w;
  const { cols, rows } = usePortrait ? p : l;
  const per = Math.max(1, cols * rows);
  const gridW = cols * cw + (cols - 1) * gap, gridH = rows * ch + (rows - 1) * gap;
  return {
    W, H, cols: Math.max(cols, 1), rows: Math.max(rows, 1), per, cw, ch, gap,
    ox: (W - gridW) / 2, oy: (H - gridH) / 2, bleed,
  };
}

/* Render one imposed sheet. side: 'front'|'back'; back pages are
   mirrored so duplex printing lines up. */
function renderSheet(cards, sheetKey, side, ppi, opts = {}) {
  const L = sheetLayout(sheetKey, opts);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(L.W * ppi);
  canvas.height = Math.round(L.H * ppi);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  cards.forEach((card, i) => {
    if (!card) return;
    let col = i % L.cols, row = Math.floor(i / L.cols);
    if (side === 'back') {
      if (opts.edge === 'short' && L.H >= L.W || opts.edge === 'long' && L.W > L.H) row = L.rows - 1 - row;
      else col = L.cols - 1 - col;
    }
    const x = (L.ox + col * (L.cw + L.gap)) * ppi;
    const y = (L.oy + row * (L.ch + L.gap)) * ppi;
    const cardCanvas = renderCardSide(card, side, ppi, { bleed: opts.bleed, export: opts.export });
    ctx.drawImage(cardCanvas, x, y);
    if (opts.marks) drawSheetMarks(ctx, x, y, L.cw * ppi, L.ch * ppi, L.bleed * ppi, ppi);
  });
  return canvas;
}

function drawSheetMarks(ctx, x, y, w, h, b, ppi) {
  const g = MARK_GAP * ppi, L = MARK_LEN * ppi;
  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(1, ppi / 300);
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  for (const tx of [x + b, x + w - b]) {
    line(tx, y - g, tx, y - g - L);
    line(tx, y + h + g, tx, y + h + g + L);
  }
  for (const ty of [y + b, y + h - b]) {
    line(x - g, ty, x - g - L, ty);
    line(x + w + g, ty, x + w + g + L, ty);
  }
  ctx.restore();
}

/* contact sheet grid: 3 columns, as many rows as fit the page */
function contactLayout(sheetKey) {
  const sheet = SHEETS[sheetKey];
  const margin = 0.5, gap = 0.24, labelH = 0.22, head = 0.1;
  const cols = 3;
  const { w: tw, h: th } = trimSize();
  const cw = (sheet.w - 2 * margin - (cols - 1) * gap) / cols;
  const ch = cw * th / tw;
  const rows = Math.max(1, Math.floor((sheet.h - 2 * margin - head + gap) / (ch + labelH + gap)));
  return { W: sheet.w, H: sheet.h, margin, gap, labelH, head, cols, rows, per: cols * rows, cw, ch };
}
function renderContactSheet(cards, sheetKey, ppi) {
  const L = contactLayout(sheetKey);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(L.W * ppi); canvas.height = Math.round(L.H * ppi);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const { w: tw } = trimSize();
  ctx.fillStyle = '#333';
  ctx.font = fontStr(10 / 72 * ppi, 'sans', 'normal', 'bold');
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${state.projectName || 'Project'} — contact sheet`, L.margin * ppi, (L.margin - 0.14) * ppi);
  cards.slice(0, L.per).forEach((card, i) => {
    const col = i % L.cols, row = Math.floor(i / L.cols);
    const x = (L.margin + col * (L.cw + L.gap)) * ppi;
    const y = (L.margin + L.head + row * (L.ch + L.labelH + L.gap)) * ppi;
    /* render each card at the sheet's own resolution so it stays sharp */
    const c = renderCardSide(card, 'front', L.cw / tw * ppi, { export: true });
    ctx.drawImage(c, x, y, L.cw * ppi, L.ch * ppi);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, L.cw * ppi, L.ch * ppi);
    ctx.fillStyle = '#555';
    ctx.font = fontStr(6.5 / 72 * ppi, 'sans');
    const idx = state.cards.indexOf(card);
    ctx.fillText(`${String((idx >= 0 ? idx : i) + 1).padStart(2, '0')}  ${card.meta.title || card.name}`, x, y + L.ch * ppi + 0.14 * ppi);
  });
  return canvas;
}

/* ═══════════════════ Live preview ═══════════════════ */
const view = {
  zoom: 1, panX: 0, panY: 0, fitMode: true,
  needsRender: true,
  cache: { front: null, back: null },   /* reused canvases, one per side */
  hits: [],                              /* front text/photo hit boxes, css-ready */
  snap: null,                            /* active snap guides while dragging */
  hover: null,                           /* front hit under the pointer */
};
const previewCanvas = $('#previewCanvas');
const viewport = $('#previewViewport');

let selectedEl = null;     /* selected back element */
let frontSel = null;       /* selected front piece: 'photo' | 'title' | 'caption' | … */

function requestRender() {
  view.needsRender = true;
  renderTimelineThumbSoon(state.sel);
  refreshTemplatesSoon();
}

function previewLoop() {
  if (view.needsRender) { view.needsRender = false; drawPreview(); }
  requestAnimationFrame(previewLoop);
}

/* geometry of what's shown: list of {card, side, x, y} in inches */
function previewContent() {
  const card = currentCard();
  if (!card) return { items: [], W: 1, H: 1 };
  const bleed = bleedIn();
  const { w: tw, h: th } = trimSize();
  const cw = tw + 2 * bleed, ch = th + 2 * bleed;
  const mode = state.ui.view;
  if (mode === 'both') {
    const portrait = viewport.clientHeight > viewport.clientWidth * 1.1;
    const gap = 0.35;
    return portrait
      ? { items: [{ card, side: 'front', x: 0, y: 0 }, { card, side: 'back', x: 0, y: ch + gap }], W: cw, H: ch * 2 + gap }
      : { items: [{ card, side: 'front', x: 0, y: 0 }, { card, side: 'back', x: cw + gap, y: 0 }], W: cw * 2 + gap, H: ch };
  }
  if (mode === 'sheet') {
    const sheetKey = state.export.pdfMode === 'sheet-letter' ? 'letter' : 'a4';
    const L = sheetLayout(sheetKey, { bleed: state.bleedOn, marks: state.marksOn });
    return { items: [{ sheet: sheetKey }], W: L.W, H: L.H };
  }
  return { items: [{ card, side: state.ui.side, x: 0, y: 0 }], W: cw, H: ch };
}

function previewPpi() {
  const rect = viewport.getBoundingClientRect();
  const { W, H } = previewContent();
  const pad = rect.width < 600 ? 18 : 48;
  const fit = Math.min((rect.width - pad * 2) / W, (rect.height - pad * 2) / H);
  return Math.max(6, fit * view.zoom);
}

function drawPreview() {
  const rect = viewport.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (previewCanvas.width !== Math.round(rect.width * dpr) || previewCanvas.height !== Math.round(rect.height * dpr)) {
    previewCanvas.width = Math.round(rect.width * dpr);
    previewCanvas.height = Math.round(rect.height * dpr);
  }
  const ctx = previewCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const card = currentCard();
  $('#emptyState').hidden = !!card;
  $('#previewHud').hidden = !card;
  view.hits = [];
  if (!card) { view._geom = null; positionOverlays(); return; }

  const content = previewContent();
  const ppi = previewPpi();
  const cx = rect.width / 2 + view.panX, cy = rect.height / 2 + view.panY;
  const ox = cx - (content.W * ppi) / 2, oy = cy - (content.H * ppi) / 2;
  view._geom = { ppi, ox, oy, content };
  updateZoomLabel();

  const renderPpi = ppi * dpr;
  if (content.items[0] && content.items[0].sheet) {
    const sheetKey = content.items[0].sheet;
    const cards = state.cards.slice(0, sheetLayout(sheetKey, { bleed: state.bleedOn, marks: state.marksOn }).per);
    const c = renderSheet(cards, sheetKey, state.ui.side, Math.min(renderPpi, 130), {
      bleed: state.bleedOn, marks: state.marksOn, edge: state.export.edge,
    });
    ctx.save();
    ctx.shadowColor = 'rgba(30,20,10,0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fff';
    ctx.fillRect(ox, oy, content.W * ppi, content.H * ppi);
    ctx.restore();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, ox, oy, content.W * ppi, content.H * ppi);
    positionOverlays();
    return;
  }

  const bleed = bleedIn();
  const { w: tw, h: th } = trimSize();
  const cw = tw + 2 * bleed, ch = th + 2 * bleed;
  for (const item of content.items) {
    const x = ox + item.x * ppi, y = oy + item.y * ppi;
    const isCur = item.card === currentCard();
    const selected = (item.side === 'back' && selectedEl && isCur) ? selectedEl : null;
    const hits = item.side === 'front' ? [] : null;
    const target = view.cache[item.side] || (view.cache[item.side] = document.createElement('canvas'));
    const c = renderCardSide(item.card, item.side, Math.min(renderPpi, 240), { bleed: state.bleedOn, selected, hits, target });
    if (hits) for (const h of hits) view.hits.push({ ...h, cx: x + h.x * ppi, cy: y + h.y * ppi, cw: h.w * ppi, ch: h.h * ppi });
    ctx.save();
    ctx.shadowColor = 'rgba(30,20,10,0.32)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, cw * ppi, ch * ppi);
    ctx.restore();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, x, y, cw * ppi, ch * ppi);

    if (state.ui.guides) drawGuides(ctx, x, y, ppi, bleed);

    /* front selection / hover outline */
    if (item.side === 'front' && isCur) {
      const outline = (h, solid) => {
        ctx.save();
        ctx.strokeStyle = '#c23b22'; ctx.lineWidth = solid ? 1.5 : 1;
        if (!solid) ctx.setLineDash([4, 3]);
        ctx.strokeRect(x + h.x * ppi - 3, y + h.y * ppi - 2, h.w * ppi + 6, h.h * ppi + 4);
        ctx.restore();
      };
      const sel = frontSel && frontSel !== 'photo' ? hits.find(h => h.key === frontSel) : null;
      if (sel) outline(sel, true);
      if (view.hover && view.hover.key !== frontSel && view.hover.key !== 'photo') {
        const hv = hits.find(h => h.key === view.hover.key);
        if (hv) outline(hv, false);
      }
    }
    /* snap guides */
    if (view.snap && item.side === 'back' && isCur) {
      ctx.save();
      ctx.strokeStyle = '#2a7de1'; ctx.lineWidth = 1;
      for (const fx of view.snap.x) { const gx = Math.round(x + (bleed + fx * tw) * ppi) + 0.5; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + ch * ppi); ctx.stroke(); }
      for (const fy of view.snap.y) { const gy = Math.round(y + (bleed + fy * th) * ppi) + 0.5; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + cw * ppi, gy); ctx.stroke(); }
      ctx.restore();
    }
    if (content.items.length > 1) {
      ctx.fillStyle = 'rgba(128,122,110,0.95)';
      ctx.font = `600 11px ${FONTS.sans}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.letterSpacing = '1px';
      ctx.fillText(item.side === 'front' ? 'FRONT' : 'BACK', x, y + ch * ppi + 8);
      ctx.letterSpacing = '0px';
    }
  }
  positionOverlays();
}

/* bleed hatch, trim line and safe area — preview only */
function hatchPattern() {
  if (hatchPattern._p) return hatchPattern._p;
  const t = document.createElement('canvas'); t.width = t.height = 8;
  const c = t.getContext('2d');
  c.strokeStyle = 'rgba(194,59,34,0.35)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-2, 6); c.lineTo(6, -2); c.moveTo(2, 10); c.lineTo(10, 2); c.stroke();
  return (hatchPattern._p = c.createPattern(t, 'repeat'));
}

function drawGuides(ctx, x, y, ppi, bleed) {
  const { w: tw, h: th } = trimSize();
  const cw = (tw + 2 * bleed) * ppi, ch = (th + 2 * bleed) * ppi;
  ctx.save();
  if (bleed > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cw, ch);
    ctx.rect(x + bleed * ppi, y + bleed * ppi, tw * ppi, th * ppi);
    ctx.clip('evenodd');
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = hatchPattern();
    ctx.fillRect(x, y, cw, ch);
    ctx.restore();
  }
  /* trim: where the card is cut */
  ctx.strokeStyle = 'rgba(20,20,20,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x + bleed * ppi) + 0.5, Math.round(y + bleed * ppi) + 0.5, Math.round(tw * ppi) - 1, Math.round(th * ppi) - 1);
  /* safe area: keep words inside */
  if (state.safeOn) {
    ctx.strokeStyle = 'rgba(42,125,225,0.75)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + (bleed + SAFE_IN) * ppi, y + (bleed + SAFE_IN) * ppi, (tw - 2 * SAFE_IN) * ppi, (th - 2 * SAFE_IN) * ppi);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function setZoom(z, focusX, focusY) {
  const rect = viewport.getBoundingClientRect();
  const fx = focusX ?? rect.width / 2, fy = focusY ?? rect.height / 2;
  const prev = view.zoom;
  z = clamp(z, 0.15, 12);
  const scale = z / prev;
  view.panX = fx - rect.width / 2 + (view.panX - (fx - rect.width / 2)) * scale;
  view.panY = fy - rect.height / 2 + (view.panY - (fy - rect.height / 2)) * scale;
  view.zoom = z;
  view.fitMode = false;
  view.needsRender = true;
}
function zoomFit() { view.zoom = 1; view.panX = 0; view.panY = 0; view.fitMode = true; view.needsRender = true; }
function zoomActual() {
  /* 1:1 print size on screen (assumes 96 css px / inch) */
  const base = previewPpi() / view.zoom;
  view.zoom = 96 / base;
  view.panX = 0; view.panY = 0; view.fitMode = false;
  view.needsRender = true;
}
function updateZoomLabel() {
  const g = view._geom;
  const pct = g ? Math.round((g.ppi / 96) * 100) : Math.round(view.zoom * 100);
  $('#zoomLevel').textContent = `${pct}%`;
}

/* ═══════════════════ Pointer interaction ═══════════════════ */
const pointers = new Map();
let gesture = null;   /* {type:'pan'|'photo'|'el-move'|'el-resize'|'pinch', ...} */

/* preview css position → the item under it and card-local inches */
function toCardCoords(cssX, cssY) {
  const g = view._geom;
  if (!g) return null;
  const bleed = bleedIn();
  const { w: tw, h: th } = trimSize();
  const cw = tw + 2 * bleed, ch = th + 2 * bleed;
  for (const it of g.content.items) {
    if (it.sheet) continue;
    const x0 = g.ox + it.x * g.ppi, y0 = g.oy + it.y * g.ppi;
    if (cssX >= x0 && cssX <= x0 + cw * g.ppi && cssY >= y0 && cssY <= y0 + ch * g.ppi) {
      return { item: it, ix: (cssX - x0) / g.ppi, iy: (cssY - y0) / g.ppi };
    }
  }
  return null;
}
function itemOrigin(side) {
  const g = view._geom;
  if (!g) return null;
  const it = g.content.items.find(i => i.side === side);
  return it ? { x: g.ox + it.x * g.ppi, y: g.oy + it.y * g.ppi, ppi: g.ppi } : null;
}

function hitBackElement(ix, iy) {
  const card = currentCard();
  if (!card) return null;
  const bleed = bleedIn();
  const { w: tw, h: th } = trimSize();
  const els = card.back.elements;
  const pad = Math.max(0.03, 6 / (view._geom ? view._geom.ppi : 60));
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (!el.visible || el.type === 'airmail') continue;   /* the border frame shouldn't swallow clicks */
    const x = bleed + el.x * tw, y = bleed + el.y * th;
    const w = el.w * tw, h = el.h * th;
    if (ix >= x - pad && ix <= x + w + pad && iy >= y - pad && iy <= y + h + pad) return el;
  }
  const air = els.find(e => e.visible && e.type === 'airmail');
  return air && iy < bleed + 0.12 ? air : null;
}
function hitFront(cssX, cssY) {
  /* text first (it sits on top of the photo), smallest box wins */
  let best = null;
  for (const h of view.hits) {
    if (h.key === 'photo') continue;
    if (cssX >= h.cx - 4 && cssX <= h.cx + h.cw + 4 && cssY >= h.cy - 3 && cssY <= h.cy + h.ch + 3) {
      if (!best || h.cw * h.ch < best.cw * best.ch) best = h;
    }
  }
  if (best) return best;
  return view.hits.find(h => h.key === 'photo' && cssX >= h.cx && cssX <= h.cx + h.cw && cssY >= h.cy && cssY <= h.cy + h.ch) || null;
}

function onHandle(el, ix, iy) {
  const bleed = bleedIn();
  const { w: tw, h: th } = trimSize();
  const hx = bleed + (el.x + el.w) * tw, hy = bleed + (el.y + el.h) * th;
  const r = Math.max(0.08, 14 / (view._geom ? view._geom.ppi : 60));
  return Math.hypot(ix - hx, iy - hy) < r;
}

/* snap a moving element to the card centre, the safe area and other elements */
function snapMove(el, nx, ny, cssTol) {
  const { w: tw, h: th } = trimSize();
  const g = view._geom;
  const tolX = cssTol / (g.ppi * tw), tolY = cssTol / (g.ppi * th);
  const xs = [0.5, SAFE_IN / tw, 1 - SAFE_IN / tw], ys = [0.5, SAFE_IN / th, 1 - SAFE_IN / th];
  for (const o of currentCard().back.elements) {
    if (o === el || !o.visible || o.type === 'airmail') continue;
    xs.push(o.x, o.x + o.w, o.x + o.w / 2); ys.push(o.y, o.y + o.h, o.y + o.h / 2);
  }
  const pick = (pos, size, targets, tol) => {
    let best = null;
    for (const [off, anchor] of [[0, 0], [size / 2, 0.5], [size, 1]]) {
      for (const t of targets) {
        const d = t - (pos + off);
        if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t };
      }
    }
    return best;
  };
  const sx = pick(nx, el.w, xs, tolX), sy = pick(ny, el.h, ys, tolY);
  view.snap = { x: sx ? [sx.line] : [], y: sy ? [sy.line] : [] };
  return { x: nx + (sx ? sx.d : 0), y: ny + (sy ? sy.d : 0) };
}

let lastTap = { t: 0, x: 0, y: 0 };
viewport.addEventListener('pointerdown', (e) => {
  if (!currentCard()) return;
  if (e.target !== previewCanvas && e.target !== viewport) return;   /* clicks on the toolbar/editor */
  if (!$('#inlineEdit').hidden) finishInlineEdit();
  viewport.setPointerCapture(e.pointerId);
  const rect = viewport.getBoundingClientRect();
  const cssX = e.clientX - rect.left, cssY = e.clientY - rect.top;
  pointers.set(e.pointerId, { x: cssX, y: cssY, sx: cssX, sy: cssY });

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    return;
  }
  /* double-tap detection for touch (dblclick is unreliable there) */
  const now = performance.now();
  const dbl = now - lastTap.t < 320 && Math.hypot(cssX - lastTap.x, cssY - lastTap.y) < 24;
  lastTap = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: cssX, y: cssY };   /* a third press starts fresh */

  const hit = toCardCoords(cssX, cssY);
  const side = hit ? hit.item.side : null;
  if (side && side !== state.ui.side && state.ui.view === 'both') { state.ui.side = side; syncSideUi(); }

  if (hit && side === 'back' && state.ui.view !== 'sheet') {
    if (frontSel) { frontSel = null; }
    if (selectedEl && onHandle(selectedEl, hit.ix, hit.iy)) {
      gesture = { type: 'el-resize', el: selectedEl, sw: selectedEl.w, sh: selectedEl.h, six: hit.ix, siy: hit.iy };
      return;
    }
    const el = hitBackElement(hit.ix, hit.iy);
    if (el) {
      const wasSelected = selectedEl === el;
      if (!wasSelected) { selectedEl = el; syncElEditor(); view.needsRender = true; }
      if (dbl && isTextual(el)) { e.preventDefault(); gesture = null; startInlineEdit({ el }); return; }
      gesture = { type: 'el-move', el, ex: el.x, ey: el.y, six: hit.ix, siy: hit.iy, moved: false, wasSelected };
      return;
    }
    if (selectedEl) { selectedEl = null; syncElEditor(); view.needsRender = true; }
  }

  if (hit && side === 'front' && state.ui.view !== 'sheet') {
    if (selectedEl) { selectedEl = null; syncElEditor(); }
    const fh = hitFront(cssX, cssY);
    if (fh && fh.key !== 'photo') {
      const was = frontSel === fh.key;
      frontSel = fh.key; view.needsRender = true;
      if (dbl || was) { e.preventDefault(); gesture = null; startInlineEdit({ front: fh.key }); return; }
      gesture = { type: 'tap' };
      return;
    }
    const card = currentCard();
    frontSel = card.imageId ? 'photo' : null;
    view.needsRender = true;
    if (card.imageId) {
      gesture = { type: 'photo', card, tx: card.front.tx.x, ty: card.front.tx.y, sx: cssX, sy: cssY, moved: false };
      viewport.classList.add('dragging');
      return;
    }
    if (dbl || !card.imageId) { $('#replaceInput').click(); return; }
  }

  if (!hit && (frontSel || selectedEl)) { frontSel = null; selectedEl = null; syncElEditor(); view.needsRender = true; }
  gesture = { type: 'pan', px: view.panX, py: view.panY, sx: cssX, sy: cssY, moved: false };
  viewport.classList.add('dragging');
});

viewport.addEventListener('pointermove', (e) => {
  const rect = viewport.getBoundingClientRect();
  const cssX = e.clientX - rect.left, cssY = e.clientY - rect.top;
  const p = pointers.get(e.pointerId);
  if (p) { p.x = cssX; p.y = cssY; }

  if (!gesture && state.ui.view !== 'sheet' && e.pointerType === 'mouse') {
    const hit = toCardCoords(cssX, cssY);
    const onBack = hit && hit.item.side === 'back';
    const el = onBack ? hitBackElement(hit.ix, hit.iy) : null;
    const fh = hit && hit.item.side === 'front' ? hitFront(cssX, cssY) : null;
    viewport.classList.toggle('resize-hover', !!(onBack && selectedEl && onHandle(selectedEl, hit.ix, hit.iy)));
    viewport.classList.toggle('el-hover', !!el);
    viewport.classList.toggle('text-hover', !!(fh && fh.key !== 'photo'));
    const hk = fh ? fh.key : null;
    if ((view.hover && view.hover.key) !== hk) { view.hover = fh; view.needsRender = true; }
  }
  if (!gesture) return;

  if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    setZoom(gesture.zoom * (d / gesture.dist), gesture.cx, gesture.cy);
    return;
  }
  if (gesture.type === 'pan') {
    if (Math.abs(cssX - gesture.sx) + Math.abs(cssY - gesture.sy) > 4) gesture.moved = true;
    /* on phones a horizontal swipe at fit zoom flips the card instead of panning */
    if (isNarrow() && view.fitMode) return;
    view.panX = gesture.px + (cssX - gesture.sx);
    view.panY = gesture.py + (cssY - gesture.sy);
    view.fitMode = false;
    view.needsRender = true;
    return;
  }
  if (gesture.type === 'photo') {
    const g = view._geom;
    if (!g) return;
    const f = gesture.card.front;
    const ov = photoOverflow.get(f) || { x: 0, y: 0 };
    if (ov.x > 0.002) f.tx.x = clamp(gesture.tx + (cssX - gesture.sx) / (g.ppi * ov.x), -1, 1);
    if (ov.y > 0.002) f.tx.y = clamp(gesture.ty + (cssY - gesture.sy) / (g.ppi * ov.y), -1, 1);
    if (Math.abs(cssX - gesture.sx) + Math.abs(cssY - gesture.sy) > 3) gesture.moved = true;
    view.needsRender = true;
    return;
  }
  const hit = toCardCoords(cssX, cssY);
  const g = view._geom;
  if (!g) return;
  const { w: tw, h: th } = trimSize();
  const o = itemOrigin('back');
  const ix = o ? (cssX - o.x) / g.ppi : (hit ? hit.ix : 0), iy = o ? (cssY - o.y) / g.ppi : (hit ? hit.iy : 0);
  if (gesture.type === 'el-move') {
    const el = gesture.el;
    let nx = gesture.ex + (ix - gesture.six) / tw;
    let ny = gesture.ey + (iy - gesture.siy) / th;
    if (Math.abs(ix - gesture.six) + Math.abs(iy - gesture.siy) > 2 / g.ppi) gesture.moved = true;
    if (!gesture.moved) return;
    if (!e.altKey) ({ x: nx, y: ny } = snapMove(el, nx, ny, 6));
    else view.snap = null;
    el.x = clamp(nx, -0.05, 0.98);
    el.y = clamp(ny, -0.05, 0.98);
    if (el.type === 'qr') $('#qrPos').value = qrPresetOf(el);
    view.needsRender = true;
  } else if (gesture.type === 'el-resize') {
    const el = gesture.el;
    el.w = clamp(gesture.sw + (ix - gesture.six) / tw, 0.03, 1.05 - el.x);
    el.h = el.type === 'qr' ? el.w * tw / th : clamp(gesture.sh + (iy - gesture.siy) / th, 0.015, 1.05 - el.y);
    if (el.type === 'qr') { el.h = el.w; $('#qrSize').value = el.w; $('#qrSizeOut').textContent = Math.round(el.w * 100) + '%'; }
    view.needsRender = true;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  viewport.classList.remove('dragging');
  if (!gesture) return;
  if (gesture.type === 'pan' && pointers.size === 0) {
    const rect = viewport.getBoundingClientRect();
    const dx = (e.clientX - rect.left) - gesture.sx, dy = (e.clientY - rect.top) - gesture.sy;
    if (isNarrow() && view.fitMode && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && state.ui.view !== 'sheet') {
      setSide(state.ui.side === 'front' ? 'back' : 'front');
    }
  }
  if (gesture.type === 'el-move' && !gesture.moved && gesture.wasSelected && isTextual(gesture.el) && e.pointerType !== 'mouse') {
    e.preventDefault();
    startInlineEdit({ el: gesture.el });   /* second tap on a selected text box edits it */
  }
  if (['photo', 'el-move', 'el-resize'].includes(gesture.type)) {
    if ((gesture.type !== 'el-move' && gesture.type !== 'photo') || gesture.moved) commit();
    if (gesture.type === 'photo') syncFrontInputs();
  }
  view.snap = null;
  view.needsRender = true;
  if (pointers.size < 2 && gesture.type === 'pinch') gesture = null;
  if (pointers.size === 0) gesture = null;
}
viewport.addEventListener('pointerup', endPointer);
viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('pointerleave', () => { if (view.hover) { view.hover = null; view.needsRender = true; } });

viewport.addEventListener('wheel', (e) => {
  if (e.target !== previewCanvas) return;
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey) {
    setZoom(view.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX - rect.left, e.clientY - rect.top);
  } else {
    view.panX -= e.deltaX; view.panY -= e.deltaY;
    view.fitMode = false;
    view.needsRender = true;
  }
}, { passive: false });

viewport.addEventListener('dblclick', (e) => {
  if (e.target !== previewCanvas) return;
  const rect = viewport.getBoundingClientRect();
  if (!toCardCoords(e.clientX - rect.left, e.clientY - rect.top)) { view.fitMode ? zoomActual() : zoomFit(); }
});

function isNarrow() { return window.matchMedia('(max-width: 900px)').matches; }
function isTextual(el) { return el && (el.type === 'text' || (el.type === 'box' && !!el.bind)); }

/* ═══════════════════ On-card editing ═══════════════════
   A textarea is laid over the text on the card, styled to match, so typing
   happens in place. The card underneath re-renders as you type. */
let inlineTarget = null;
const inlineCommit = debounce(() => commit(), 600);

function frontFieldValue(card, key) {
  const m = card.meta, f = card.front;
  switch (key) {
    case 'title': return m.title;
    case 'caption': return m.caption;
    case 'location': return m.location;
    case 'date': return m.date;
    case 'tagline': return f.tagline != null ? f.tagline : 'Greetings from';
    case 'credit': return creditText(card);
  }
  return '';
}
function setFrontField(card, key, v) {
  const m = card.meta, f = card.front;
  switch (key) {
    case 'title': m.title = v; break;
    case 'caption': m.caption = v; break;
    case 'location': m.location = v; break;
    case 'date': m.date = v; break;
    case 'tagline': f.tagline = v; break;
    case 'credit': f.creditFormat = 'custom'; f.creditCustom = v; break;
  }
}
/* raw text of a back element (tokens left as typed) */
function elValue(card, el) {
  if (!el.bind) return el.text || '';
  const m = card.meta;
  switch (el.bind) {
    case 'caption': return m.caption || m.title;
    case 'story': return m.story;
    case 'date': return m.date;
    case 'location': case 'coords': return m.location;
    case 'title': case 'cta': return m.title;
    case 'edition': return m.edition;
    case 'camera': return m.camera;
    case 'website': return state.global.website;
    case 'project': return state.global.project;
    case 'copyright': return state.global.copyright;
    case 'placeName': return m.location || m.title;
  }
  return bindTextReal(card, el.bind);
}
/* write edited text back to wherever the element gets it from */
function setElValue(card, el, v) {
  if (!el.bind) { el.text = v; return; }
  const m = card.meta;
  switch (el.bind) {
    case 'caption': m.caption = v; break;
    case 'story': m.story = v; break;
    case 'date': m.date = v; break;
    case 'location': case 'coords': m.location = v; break;
    case 'title': case 'cta': m.title = v; break;
    case 'edition': m.edition = v; break;
    case 'camera': m.camera = v; break;
    case 'placeName': m.location = v; break;
    case 'website': state.global.website = v; break;
    case 'project': state.global.project = v; break;
    case 'copyright': state.global.copyright = v; break;
    default: el.bind = null; el.text = v;   /* credit, meta, bio… become plain text */
  }
}

function startInlineEdit(target) {
  const card = currentCard();
  if (!card) return;
  const ta = $('#inlineEdit');
  inlineTarget = target;
  if (target.el) {
    ta.value = elValue(card, target.el);
    ta.dataset.multiline = '1';
  } else {
    ta.value = frontFieldValue(card, target.front);
    ta.dataset.multiline = '';   /* front lines: Enter finishes, Shift+Enter breaks the line */
  }
  ta.hidden = false;
  inlineOpenedAt = performance.now();
  positionOverlays();
  /* short labels: select all so typing replaces; longer text: caret at the end */
  const place = () => { if (ta.value.length <= 40) ta.select(); else ta.setSelectionRange(ta.value.length, ta.value.length); };
  ta.focus();
  place();
  requestAnimationFrame(() => { if (!ta.hidden && document.activeElement !== ta) { ta.focus(); place(); } });
}
let inlineOpenedAt = 0;
function finishInlineEdit() {
  const ta = $('#inlineEdit');
  if (ta.hidden) return;
  ta.hidden = true;
  inlineTarget = null;
  inlineCommit.flush ? inlineCommit.flush() : commit();
  syncAllInputs();
  view.needsRender = true;
}
function bindInlineEditor() {
  const ta = $('#inlineEdit');
  ta.addEventListener('input', () => {
    const card = currentCard();
    if (!card || !inlineTarget) return;
    if (inlineTarget.el) setElValue(card, inlineTarget.el, ta.value);
    else setFrontField(card, inlineTarget.front, ta.value);
    view.needsRender = true;
    renderTimelineThumbSoon(state.sel);
    inlineCommit();
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && !ta.dataset.multiline)) { e.preventDefault(); finishInlineEdit(); }
    e.stopPropagation();
  });
  ta.addEventListener('blur', () => setTimeout(() => {
    /* ignore the focus wobble of the click that opened the editor */
    if (performance.now() - inlineOpenedAt < 250 && !ta.hidden) { ta.focus(); return; }
    if (document.activeElement !== ta) finishInlineEdit();
  }, 0));
}

/* place the floating toolbar and the inline editor over the current selection */
function selectionRect() {
  const g = view._geom;
  const card = currentCard();
  if (!g || !card) return null;
  if (selectedEl && state.ui.side === 'back') {
    const o = itemOrigin('back');
    if (!o) return null;
    const { w: tw, h: th } = trimSize();
    const b = bleedIn();
    return { x: o.x + (b + selectedEl.x * tw) * g.ppi, y: o.y + (b + selectedEl.y * th) * g.ppi, w: selectedEl.w * tw * g.ppi, h: selectedEl.h * th * g.ppi };
  }
  if (frontSel && state.ui.side === 'front') {
    const h = view.hits.find(x => x.key === frontSel);
    if (h) return { x: h.cx, y: h.cy, w: h.cw, h: h.ch, hit: h };
  }
  return null;
}
function positionOverlays() {
  const bar = $('#ctxBar'), ta = $('#inlineEdit');
  const r = selectionRect();
  const vw = viewport.clientWidth;
  const editing = !ta.hidden;
  if (editing && r && inlineTarget) {
    const g = view._geom;
    let font, sizePx, align, color, style = 'normal', weight = 'normal', lh;
    if (inlineTarget.el) {
      const el = inlineTarget.el;
      sizePx = (el.size || 9) / 72 * g.ppi; font = el.font || 'sans'; align = el.align || 'left';
      color = el.color || '#2a2a2a'; style = el.style || 'normal'; weight = el.weight || 'normal'; lh = el.lineHeight || 1.45;
    } else {
      const h = r.hit;
      sizePx = (h.sizeIn || 0.1) * g.ppi; font = h.font || 'sans'; align = h.align || 'left';
      color = h.color || '#222'; style = h.style || 'normal'; weight = h.weight || 'normal'; lh = h.lh || 1.25;
    }
    ta.style.font = `${style === 'italic' ? 'italic ' : ''}${weight === 'bold' ? '600 ' : ''}${sizePx}px/${lh} ${FONTS[font] || FONTS.sans}`;
    ta.style.textAlign = align;
    const lightText = /^rgba?\(\s*2[0-9]{2}/.test(color) || (/^#/.test(color) && luminance(color) > 0.6);
    ta.style.color = lightText ? '#fff' : (/^#/.test(color) ? color : '#222');
    ta.style.background = lightText ? 'rgba(20,18,15,0.82)' : 'rgba(255,255,255,0.95)';
    const minW = Math.max(r.w, 60);
    ta.style.left = (r.x - (minW - r.w) / 2) + 'px';
    ta.style.top = r.y + 'px';
    ta.style.width = minW + 'px';
    ta.style.height = 'auto';
    ta.style.height = Math.max(r.h, ta.scrollHeight, sizePx * lh) + 'px';
  }
  if (!r || editing || gesture && gesture.type !== 'tap') { bar.hidden = true; return; }
  buildCtxBar();
  if (!bar.childElementCount) { bar.hidden = true; return; }
  bar.hidden = false;
  const bw = bar.offsetWidth;
  let x = clamp(r.x + r.w / 2, bw / 2 + 6, vw - bw / 2 - 6);
  let y = r.y - 10;
  if (y - bar.offsetHeight < 6) { y = r.y + r.h + 10 + bar.offsetHeight; }
  bar.style.left = x + 'px';
  bar.style.top = y + 'px';
}

/* contextual toolbar contents */
let ctxKey = '';
function buildCtxBar() {
  const bar = $('#ctxBar');
  const card = currentCard();
  const key = selectedEl ? `el:${selectedEl.id}:${selectedEl.size}:${selectedEl.weight}:${selectedEl.style}:${selectedEl.align}:${selectedEl.font}` : frontSel ? `f:${frontSel}:${card && card.front.fit}:${card && card.front.tx.zoom}` : '';
  if (key === ctxKey && bar.childElementCount) return;
  ctxKey = key;
  bar.innerHTML = '';
  const btn = (label, title, fn, on) => {
    const b = document.createElement('button');
    b.type = 'button'; b.innerHTML = label; b.title = title; b.setAttribute('aria-label', title);
    if (on) b.classList.add('on');
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    bar.appendChild(b);
    return b;
  };
  const sep = () => { const s = document.createElement('span'); s.className = 'sep'; bar.appendChild(s); };
  if (!card) return;
  if (selectedEl) {
    const el = selectedEl;
    const changed = () => { commit(); syncElEditor(); view.needsRender = true; };
    if (isTextual(el)) {
      btn('Edit', 'Type on the card (Enter)', () => startInlineEdit({ el }));
      sep();
      btn('A−', 'Smaller', () => { el.size = clamp(+(el.size - (el.size > 14 ? 2 : 0.5)).toFixed(1), 4, 96); changed(); });
      btn('A+', 'Bigger', () => { el.size = clamp(+(el.size + (el.size >= 14 ? 2 : 0.5)).toFixed(1), 4, 96); changed(); });
      if (el.type === 'text') {
        btn('<b>B</b>', 'Bold', () => { el.weight = el.weight === 'bold' ? 'normal' : 'bold'; changed(); }, el.weight === 'bold');
        btn('<i style="font-family:Georgia,serif">I</i>', 'Italic', () => { el.style = el.style === 'italic' ? 'normal' : 'italic'; changed(); }, el.style === 'italic');
        const alignIcon = { left: '⇤', center: '↔', right: '⇥' }[el.align || 'left'];
        btn(alignIcon, 'Alignment', () => { el.align = { left: 'center', center: 'right', right: 'left' }[el.align || 'left']; changed(); });
        const fonts = ['sans', 'serif', 'editorial', 'display', 'mono', 'script'];
        const names = { sans: 'Sans', serif: 'Serif', editorial: 'Editorial', display: 'Poster', mono: 'Type', script: 'Script' };
        btn(names[el.font] || 'Sans', 'Font', () => { el.font = fonts[(fonts.indexOf(el.font) + 1) % fonts.length]; changed(); });
        const c = document.createElement('input');
        c.type = 'color'; c.value = /^#[0-9a-f]{6}$/i.test(el.color) ? el.color : '#2a2a2a'; c.title = 'Ink colour'; c.setAttribute('aria-label', 'Ink colour');
        c.addEventListener('pointerdown', (e) => e.stopPropagation());
        c.addEventListener('input', () => { el.color = c.value; view.needsRender = true; });
        c.addEventListener('change', changed);
        bar.appendChild(c);
      }
      sep();
    }
    btn('Duplicate', 'Duplicate (Ctrl+D)', duplicateSelected);
    btn(el.type === 'text' && !el.bind ? 'Delete' : 'Hide', 'Remove from the card (Delete)', () => $('#elHide').click());
    return;
  }
  if (frontSel === 'photo') {
    const f = card.front;
    btn('−', 'Zoom out', () => { f.tx.zoom = clamp(f.tx.zoom / 1.15, 1, 3); commit(); syncFrontInputs(); view.needsRender = true; });
    const r = document.createElement('input');
    r.type = 'range'; r.min = 1; r.max = 3; r.step = 0.01; r.value = f.tx.zoom; r.setAttribute('aria-label', 'Photo zoom');
    r.addEventListener('pointerdown', (e) => e.stopPropagation());
    r.addEventListener('input', () => { f.tx.zoom = parseFloat(r.value); $('#fZoom').value = r.value; $('#fZoomOut').textContent = Math.round(f.tx.zoom * 100) + '%'; view.needsRender = true; });
    r.addEventListener('change', () => commit());
    bar.appendChild(r);
    btn('+', 'Zoom in', () => { f.tx.zoom = clamp(f.tx.zoom * 1.15, 1, 3); commit(); syncFrontInputs(); view.needsRender = true; });
    sep();
    btn('↻', 'Rotate 90°', () => { f.tx.rot = (f.tx.rot + 90) % 360; commit(); view.needsRender = true; });
    btn(f.fit === 'fill' ? 'Show whole' : 'Fill frame', 'Switch between filling the frame and showing the whole photo', () => { f.fit = f.fit === 'fill' ? 'fit' : 'fill'; commit(); syncFrontInputs(); view.needsRender = true; });
    btn('Replace', 'Use a different photo', () => $('#replaceInput').click());
    return;
  }
  if (frontSel) {
    btn('Edit', 'Type on the card', () => startInlineEdit({ front: frontSel }));
    const f = card.front;
    const hideable = { title: 'title', caption: 'caption' }[frontSel];
    if (hideable) btn('Hide', 'Hide on this card', () => { f.show[hideable] = false; frontSel = null; commit(); syncFrontInputs(); view.needsRender = true; });
    if (frontSel === 'credit') btn('Hide', 'Hide the credit', () => { f.creditPlace = 'hidden'; frontSel = null; commit(); syncFrontInputs(); view.needsRender = true; });
    if (frontSel === 'tagline') btn('Remove', 'Remove the greeting line', () => { f.tagline = ''; frontSel = null; commit(); syncFrontInputs(); view.needsRender = true; });
  }
}

function duplicateSelected() {
  const card = currentCard();
  if (!card || !selectedEl || selectedEl.type === 'qr' || selectedEl.type === 'postmark' || selectedEl.type === 'airmail') {
    if (selectedEl) toast('There can only be one of those on a card.');
    return;
  }
  const copy = deepClone(selectedEl);
  copy.id = uid();
  if (copy.bind && copy.type === 'text') { copy.text = bindTextReal(card, copy.bind) || ''; copy.bind = null; }
  copy.x = clamp(copy.x + 0.03, -0.05, 0.95); copy.y = clamp(copy.y + 0.04, -0.05, 0.95);
  card.back.elements.push(copy);
  selectedEl = copy;
  commit(); syncBackInputs(); syncElEditor(); view.needsRender = true;
}

/* ═══════════════════ Export engine ═══════════════════ */
function canvasToBlob(canvas, type, quality) {
  return new Promise(res => canvas.toBlob(res, type, quality));
}
async function canvasToBytes(canvas, format) {
  if (format === 'png') {
    const blob = await canvasToBlob(canvas, 'image/png');
    return pngWithDpi(await blob.arrayBuffer());
  }
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
  return jpegWithDpi(await blob.arrayBuffer());
}

function fileName(card, index, side, ext) {
  const pattern = state.export.pattern === 'custom'
    ? (state.export.custom || '{name}-{side}')
    : state.export.pattern;
  const name = pattern
    .replaceAll('{name}', card ? card.name : 'sheet')
    .replaceAll('{project}', sanitizeName(state.projectName))
    .replaceAll('{title}', sanitizeName(card && card.meta.title || (card ? card.name : 'postcard')))
    .replaceAll('{index}', String(index + 1).padStart(3, '0'))
    .replaceAll('{side}', side)
    .replaceAll('{date}', new Date().toISOString().slice(0, 10));
  return sanitizeName(name) + '.' + ext;
}

/* ── Minimal print-ready PDF writer ──
   Pages are sized in points; card faces are embedded as 300 DPI JPEGs
   (DCTDecode); crop marks are drawn as vector strokes. */
class PdfWriter {
  constructor() { this.objects = ['']; this.pages = []; }
  addObject(content) { this.objects.push(content); return this.objects.length - 1; }
  /* images: [{bytes, w, h, x, y, dw, dh}] in points; marks: [{x1,y1,x2,y2}] */
  addPage(wPt, hPt, images, marks = []) {
    const imgRefs = images.map((im, i) => {
      const id = this.addObject({
        stream: im.bytes,
        dict: `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} ` +
              `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>`,
      });
      return { id, name: `Im${i}`, im };
    });
    let ops = '';
    for (const r of imgRefs) {
      ops += `q ${r.im.dw.toFixed(2)} 0 0 ${r.im.dh.toFixed(2)} ${r.im.x.toFixed(2)} ${(hPt - r.im.y - r.im.dh).toFixed(2)} cm /${r.name} Do Q\n`;
    }
    if (marks.length) {
      ops += '0 0 0 RG 0.5 w\n';
      for (const mk of marks) {
        ops += `${mk.x1.toFixed(2)} ${(hPt - mk.y1).toFixed(2)} m ${mk.x2.toFixed(2)} ${(hPt - mk.y2).toFixed(2)} l S\n`;
      }
    }
    const contentBytes = new TextEncoder().encode(ops);
    const contentId = this.addObject({ stream: contentBytes, dict: `<< /Length ${contentBytes.length} >>` });
    const xobj = imgRefs.map(r => `/${r.name} ${r.id} 0 R`).join(' ');
    this.pages.push({ wPt, hPt, contentId, xobj });
  }
  build() {
    const enc = new TextEncoder();
    const pagesId = this.addObject(null);   /* placeholder, filled below */
    const pageIds = this.pages.map(p => this.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${p.wPt.toFixed(2)} ${p.hPt.toFixed(2)}] ` +
      `/Resources << /XObject << ${p.xobj} >> >> /Contents ${p.contentId} 0 R >>`
    ));
    this.objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const infoId = this.addObject(`<< /Producer (Postcard Press by Storitellah) /Creator (Postcard Press) >>`);

    const chunks = [];
    let offset = 0;
    const push = (data) => {
      const bytes = typeof data === 'string' ? enc.encode(data) : data;
      chunks.push(bytes); offset += bytes.length;
    };
    const offsets = new Array(this.objects.length).fill(0);
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    for (let i = 1; i < this.objects.length; i++) {
      offsets[i] = offset;
      const o = this.objects[i];
      if (o && typeof o === 'object' && o.stream) {
        push(`${i} 0 obj\n${o.dict}\nstream\n`);
        push(o.stream);
        push('\nendstream\nendobj\n');
      } else {
        push(`${i} 0 obj\n${o}\nendobj\n`);
      }
    }
    const xrefAt = offset;
    let xref = `xref\n0 ${this.objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < this.objects.length; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    push(xref);
    push(`trailer\n<< /Size ${this.objects.length} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
}

async function jpegBytesOf(canvas) {
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
  return jpegWithDpi(await blob.arrayBuffer());
}

/* one card per page, at print size (+ bleed + optional marks) */
async function buildCardsPdf(cards, sides, opts) {
  await ensureFonts();
  const pdf = new PdfWriter();
  const { w: tw, h: th } = trimSize();
  const bleed = opts.bleed ? BLEED_IN : 0;
  const slug = opts.marks ? MARK_LEN + MARK_GAP + 0.02 : 0;
  const wPt = (tw + 2 * bleed + 2 * slug) * 72, hPt = (th + 2 * bleed + 2 * slug) * 72;
  for (const card of cards) {
    for (const side of sides) {
      const canvas = renderCardSide(card, side, DPI, { bleed: opts.bleed, export: true });
      const bytes = await jpegBytesOf(canvas);
      const marks = [];
      if (opts.marks) {
        const t0 = (slug + bleed) * 72, g = MARK_GAP * 72, L = MARK_LEN * 72;
        const t1w = t0 + tw * 72, t1h = t0 + th * 72, b = bleed * 72;
        for (const x of [t0, t1w]) {
          marks.push({ x1: x, y1: t0 - b - g, x2: x, y2: t0 - b - g - L });
          marks.push({ x1: x, y1: t1h + b + g, x2: x, y2: t1h + b + g + L });
        }
        for (const y of [t0, t1h]) {
          marks.push({ x1: t0 - b - g, y1: y, x2: t0 - b - g - L, y2: y });
          marks.push({ x1: t1w + b + g, y1: y, x2: t1w + b + g + L, y2: y });
        }
      }
      pdf.addPage(wPt, hPt, [{
        bytes, w: canvas.width, h: canvas.height,
        x: slug * 72, y: slug * 72,
        dw: (tw + 2 * bleed) * 72, dh: (th + 2 * bleed) * 72,
      }], marks);
    }
  }
  return pdf.build();
}

/* imposed duplex-ready sheets */
async function buildSheetPdf(cards, sheetKey, sides, opts) {
  await ensureFonts();
  const pdf = new PdfWriter();
  const L = sheetLayout(sheetKey, opts);
  const wPt = L.W * 72, hPt = L.H * 72;
  for (let start = 0; start < cards.length; start += L.per) {
    const batch = cards.slice(start, start + L.per);
    for (const side of sides) {
      const canvas = renderSheet(batch, sheetKey, side, DPI, { ...opts, export: true });
      const bytes = await jpegBytesOf(canvas);
      pdf.addPage(wPt, hPt, [{ bytes, w: canvas.width, h: canvas.height, x: 0, y: 0, dw: wPt, dh: hPt }]);
    }
  }
  return pdf.build();
}

async function buildContactPdf(cards, sheetKey) {
  await ensureFonts();
  const pdf = new PdfWriter();
  const perPage = contactLayout(sheetKey).per;
  for (let start = 0; start < cards.length; start += perPage) {
    const canvas = renderContactSheet(cards.slice(start, start + perPage), sheetKey, 200);
    const bytes = await jpegBytesOf(canvas);
    pdf.addPage(SHEETS[sheetKey].w * 72, SHEETS[sheetKey].h * 72,
      [{ bytes, w: canvas.width, h: canvas.height, x: 0, y: 0, dw: SHEETS[sheetKey].w * 72, dh: SHEETS[sheetKey].h * 72 }]);
  }
  return pdf.build();
}

async function runExport() {
  const ex = state.export;
  const cards = ex.scope === 'current' ? [currentCard()].filter(Boolean) : state.cards.slice();
  if (!cards.length) { toast('Nothing to export yet — add a postcard first.'); return; }
  const sides = ex.sides === 'both' ? ['front', 'back'] : [ex.sides];
  await showProgress('Rendering at 300 DPI…');
  try {
    if (ex.format === 'pdf') {
      let blob;
      if (ex.pdfMode === 'sheet-a4') blob = await buildSheetPdf(cards, 'a4', sides, { bleed: ex.bleed, marks: ex.marks, edge: ex.edge });
      else if (ex.pdfMode === 'sheet-letter') blob = await buildSheetPdf(cards, 'letter', sides, { bleed: ex.bleed, marks: ex.marks, edge: ex.edge });
      else if (ex.pdfMode === 'contact') blob = await buildContactPdf(cards, 'a4');
      else blob = await buildCardsPdf(cards, sides, { bleed: ex.bleed, marks: ex.marks });
      const single = cards.length === 1 && ex.pdfMode === 'cards';
      downloadBlob(blob, single ? fileName(cards[0], state.cards.indexOf(cards[0]), 'postcard', 'pdf')
                                : sanitizeName(state.projectName) + '-postcards.pdf');
      toast('PDF exported — print-ready at 300 DPI.');
    } else {
      const files = [];
      for (let i = 0; i < cards.length; i++) {
        $('#progressText').textContent = `Rendering ${i + 1} of ${cards.length}…`;
        await new Promise(r => setTimeout(r, 0));
        for (const side of sides) {
          const canvas = renderCardSide(cards[i], side, DPI, { bleed: ex.bleed, marks: ex.marks, export: true });
          const bytes = await canvasToBytes(canvas, ex.format);
          files.push({ name: fileName(cards[i], state.cards.indexOf(cards[i]), side, ex.format), data: bytes });
        }
      }
      if (files.length === 1) {
        downloadBlob(new Blob([files[0].data], { type: ex.format === 'png' ? 'image/png' : 'image/jpeg' }), files[0].name);
        toast(`Exported ${files[0].name}`);
      } else {
        downloadBlob(makeZip(files), sanitizeName(state.projectName) + '-postcards.zip');
        toast(`Exported ${files.length} files as a ZIP.`);
      }
    }
  } catch (err) {
    console.error(err);
    toast('Export failed: ' + err.message);
  } finally {
    hideProgress();
  }
}

/* ═══════════════════ Printing ═══════════════════ */
/* Print canvases at their true physical size (ppi = pixels per inch they were
   rendered at). pageSize: CSS @page size for full sheets, or null for cards. */
async function printCanvases(canvases, ppi = 200, pageSize = null) {
  document.querySelectorAll('.print-root, #printPageStyle').forEach(n => n.remove());
  const root = document.createElement('div');
  root.className = 'print-root';
  for (const c of canvases) {
    const page = document.createElement('div');
    page.className = 'print-page';
    const img = document.createElement('img');
    img.src = c.toDataURL('image/jpeg', 0.94);
    img.style.width = (c.width / ppi) + 'in';
    img.style.height = (c.height / ppi) + 'in';
    await new Promise(r => { img.onload = r; img.onerror = r; });
    page.appendChild(img);
    root.appendChild(page);
  }
  const st = document.createElement('style');
  st.id = 'printPageStyle';
  const orient = canvases[0] && canvases[0].width > canvases[0].height ? 'landscape' : 'portrait';
  st.textContent = pageSize ? `@page { size: ${pageSize} ${orient}; margin: 0; }` : '@page { margin: 0.25in; }';
  document.head.appendChild(st);
  document.body.appendChild(root);
  const cleanup = () => { root.remove(); st.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

async function runPrint() {
  const ex = state.export;
  const cards = ex.scope === 'current' ? [currentCard()].filter(Boolean) : state.cards.slice();
  if (!cards.length) { toast('Nothing to print yet.'); return; }
  const sides = ex.sides === 'both' ? ['front', 'back'] : [ex.sides];
  await showProgress('Preparing print pages…');
  await ensureFonts();
  try {
    const canvases = [];
    if (ex.pdfMode === 'sheet-a4' || ex.pdfMode === 'sheet-letter') {
      const key = ex.pdfMode === 'sheet-letter' ? 'letter' : 'a4';
      const L = sheetLayout(key, { bleed: ex.bleed, marks: ex.marks });
      for (let start = 0; start < cards.length; start += L.per) {
        for (const side of sides) {
          canvases.push(renderSheet(cards.slice(start, start + L.per), key, side, 200, { bleed: ex.bleed, marks: ex.marks, edge: ex.edge, export: true }));
        }
      }
    } else {
      for (const card of cards) for (const side of sides) {
        canvases.push(renderCardSide(card, side, 200, { bleed: ex.bleed, marks: ex.marks, export: true }));
      }
    }
    hideProgress();
    const sheetMode = ex.pdfMode === 'sheet-a4' || ex.pdfMode === 'sheet-letter';
    await printCanvases(canvases, 200, sheetMode ? (ex.pdfMode === 'sheet-letter' ? 'letter' : 'A4') : null);
  } catch (err) {
    hideProgress();
    toast('Print failed: ' + err.message);
  }
}

/* ═══════════════════ Duplex preview ═══════════════════ */
const duplex = { edge: 'long', sheet: 'a4', guides: true };

function renderDuplexPreview() {
  const wrap = $('#duplexPages');
  wrap.innerHTML = '';
  const cards = state.cards.slice();
  if (!cards.length) {
    wrap.innerHTML = '<p class="hint">Add postcards first to preview duplex sheets.</p>';
    return;
  }
  const opts = { bleed: state.bleedOn, marks: state.marksOn, edge: duplex.edge };
  const L = sheetLayout(duplex.sheet, opts);
  const batch = cards.slice(0, L.per);
  const ppi = 60;
  for (const side of ['front', 'back']) {
    const c = renderSheet(batch, duplex.sheet, side, ppi, { ...opts, export: true });
    if (duplex.guides) {
      const ctx = c.getContext('2d');
      ctx.save();
      ctx.strokeStyle = 'rgba(226,105,79,0.8)';
      ctx.setLineDash([6, 5]); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(c.width / 2, 0); ctx.lineTo(c.width / 2, c.height);
      ctx.moveTo(0, c.height / 2); ctx.lineTo(c.width, c.height / 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(226,105,79,0.9)';
      ctx.font = `700 ${ppi * 0.14}px ${FONTS.sans}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(side === 'front' ? 'SIDE 1 — FRONTS' : `SIDE 2 — BACKS (${duplex.edge}-edge flip)`, ppi * 0.14, ppi * 0.1);
      ctx.restore();
    }
    const div = document.createElement('div');
    div.className = 'duplex-page';
    div.appendChild(c);
    const label = document.createElement('div');
    label.className = 'dup-label';
    label.textContent = side === 'front'
      ? `Sheet side 1 · ${SHEETS[duplex.sheet].label} · ${batch.length} card${batch.length > 1 ? 's' : ''}`
      : `Sheet side 2 · mirrored for ${duplex.edge}-edge flip`;
    div.appendChild(label);
    wrap.appendChild(div);
  }
}

function alignmentTestCanvases(sheetKey, edge) {
  /* Test print: one sheet with numbered corner targets on both sides so
     users can verify their printer's duplex alignment before wasting stock. */
  const ppi = 200;
  const sheet = SHEETS[sheetKey];
  const out = [];
  for (const side of [1, 2]) {
    const c = document.createElement('canvas');
    c.width = Math.round(sheet.w * ppi); c.height = Math.round(sheet.h * ppi);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#222'; ctx.fillStyle = '#222';
    ctx.lineWidth = 2;
    const m = 0.5 * ppi, r = 0.22 * ppi;
    const corners = [[m, m], [c.width - m, m], [m, c.height - m], [c.width - m, c.height - m]];
    corners.forEach(([x, y], i) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 1.4, y); ctx.lineTo(x + r * 1.4, y);
      ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x, y + r * 1.4); ctx.stroke();
      ctx.font = `700 ${0.16 * ppi}px ${FONTS.sans}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x + r * 1.9, y);
    });
    ctx.font = `700 ${0.2 * ppi}px ${FONTS.sans}`;
    ctx.textAlign = 'center';
    ctx.fillText(`DUPLEX ALIGNMENT TEST — SIDE ${side} (${edge}-edge flip)`, c.width / 2, c.height / 2 - 0.3 * ppi);
    ctx.font = `${0.13 * ppi}px ${FONTS.sans}`;
    ctx.fillText('Print duplex, hold the sheet up to the light:', c.width / 2, c.height / 2 + 0.05 * ppi);
    ctx.fillText('the circled targets on both sides should overlap.', c.width / 2, c.height / 2 + 0.28 * ppi);
    out.push(c);
  }
  return out;
}

/* ═══════════════════ Demo project ═══════════════════ */
function demoPhoto(kind, w = 1800, h = 1200) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, h);
  if (kind === 'dusk') {
    sky.addColorStop(0, '#2b3a67'); sky.addColorStop(0.55, '#b56576'); sky.addColorStop(0.8, '#e8985e');
  } else if (kind === 'coast') {
    sky.addColorStop(0, '#7fb2d9'); sky.addColorStop(0.6, '#cfe4ee'); sky.addColorStop(0.85, '#e9ddc8');
  } else {
    sky.addColorStop(0, '#f2c57c'); sky.addColorStop(0.5, '#dd9a5b'); sky.addColorStop(0.9, '#8a5a44');
  }
  x.fillStyle = sky; x.fillRect(0, 0, w, h);
  /* sun / moon */
  const sunY = kind === 'coast' ? h * 0.3 : h * 0.52;
  const glow = x.createRadialGradient(w * 0.68, sunY, 10, w * 0.68, sunY, h * 0.32);
  glow.addColorStop(0, 'rgba(255,244,214,0.95)'); glow.addColorStop(1, 'rgba(255,244,214,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, w, h);
  x.fillStyle = kind === 'dusk' ? '#ffe9c9' : '#fff7e0';
  x.beginPath(); x.arc(w * 0.68, sunY, h * 0.07, 0, Math.PI * 2); x.fill();
  /* ridges */
  const ridges = kind === 'coast' ? 2 : 3;
  for (let i = 0; i < ridges; i++) {
    const baseY = h * (0.58 + i * 0.13);
    const shade = 0.5 - i * 0.14;
    x.fillStyle = kind === 'dusk' ? `rgba(24,26,48,${0.9 - i * 0.2})`
      : kind === 'coast' ? `rgba(52,90,110,${0.75 - i * 0.22})`
      : `rgba(74,44,32,${0.85 - i * 0.2})`;
    x.beginPath();
    x.moveTo(0, h);
    x.lineTo(0, baseY + Math.sin(i * 9) * 30);
    for (let px = 0; px <= w; px += 24) {
      const yy = baseY + Math.sin(px * 0.004 + i * 2.4) * h * 0.05 + Math.sin(px * 0.013 + i) * h * (0.022 - shade * 0.008);
      x.lineTo(px, yy);
    }
    x.lineTo(w, h);
    x.closePath(); x.fill();
  }
  if (kind === 'coast') {
    x.fillStyle = 'rgba(36,72,96,0.85)';
    x.fillRect(0, h * 0.72, w, h * 0.28);
    for (let i = 0; i < 14; i++) {
      x.fillStyle = `rgba(255,255,255,${0.16 - i * 0.01})`;
      const y = h * (0.74 + i * 0.017);
      x.fillRect(w * (0.05 + Math.sin(i * 3.1) * 0.04), y, w * (0.9 - i * 0.03), 2.5);
    }
  }
  /* birds */
  x.strokeStyle = 'rgba(20,20,30,0.65)'; x.lineWidth = 3; x.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const bx = w * (0.2 + i * 0.07 + Math.sin(i * 5) * 0.03), by = h * (0.24 + Math.sin(i * 2) * 0.05);
    const s = 14 + i * 2;
    x.beginPath(); x.moveTo(bx - s, by); x.quadraticCurveTo(bx - s / 2, by - s / 2, bx, by);
    x.quadraticCurveTo(bx + s / 2, by - s / 2, bx + s, by); x.stroke();
  }
  /* grain for a photographic feel */
  const id = x.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  x.putImageData(id, 0, 0);
  return c.toDataURL('image/jpeg', 0.92);
}

async function loadDemoProject() {
  await showProgress('Building the demo project…');
  try {
    const demos = [
      { kind: 'dusk', w: 1800, h: 1200, name: 'evening-ridge',
        title: 'Evening over the Ridge', caption: 'Last light settles over the valley.',
        story: 'Shot on the final evening of the workshop, just as the haze lifted. The ridge went quiet, and for a few minutes the whole valley held its breath.',
        location: 'Rift Valley', date: 'March 2026', layoutF: 'classic-gallery', layoutB: 'classic-universal' },
      { kind: 'coast', w: 1200, h: 1600, name: 'morning-tide',
        title: 'Morning Tide', caption: 'The sea returning at first light.',
        story: 'A slow exposure at dawn. Fishermen were already out beyond the sandbar; the tide came back in around their footprints.',
        location: 'Coastal Kenya', date: 'January 2026', layoutF: 'museum-broadsheet', layoutB: 'field-note' },
      { kind: 'dune', w: 1800, h: 1200, name: 'golden-hour',
        title: 'Golden Hour', caption: 'Dust and light across the plains.',
        story: 'The herd crossed just before sunset, kicking dust into the low sun. This frame is for everyone who waited with me.',
        location: 'Amboseli', date: 'June 2026', layoutF: 'fullbleed-modern', layoutB: 'art-print' },
    ];
    state.global.photographer = '';
    state.global.project = 'Postcards from the Field';
    state.projectName = 'demo-project';
    state.cards = [];
    for (const d of demos) {
      const id = await addImageFromDataURL(demoPhoto(d.kind, d.w, d.h), d.name + '.jpg');
      const card = makeCard(id, d.name);
      card.meta.title = d.title; card.meta.caption = d.caption; card.meta.story = d.story;
      card.meta.location = d.location; card.meta.date = d.date;
      applyFrontPreset(card.front, d.layoutF);
      card.back = defaultBack(d.layoutB);
      state.cards.push(card);
    }
    state.sel = 0;
    selectedEl = null;
    commit();
    syncAllInputs(); renderTimeline(); renderMediaList();
    zoomFit(); requestRender();
    toast('Three sample cards. Click anything on a card to change it.');
  } finally {
    hideProgress();
  }
}

/* ═══════════════════ Front layout presets ═══════════════════ */
/* Apply a declarative front preset to the front model (keeps photo transform). */
function applyFrontPreset(front, presetId) {
  const p = FRONT_PRESETS.find(x => x.id === presetId);
  front.style = presetId;
  front.layout = presetId;
  if (!p || !p.front) return;              /* 'custom' keeps current values */
  const d = p.front;
  front.borderW = d.borderW; front.borderBottom = d.borderBottom; front.borderColor = d.borderColor;
  front.fit = d.fit;
  front.matHairline = !!d.matHairline;
  front.captionStyle = d.captionStyle || 'serif';
  front.overlayCorners = !!d.overlayCorners;
  front.creditPlace = d.creditPlace || front.creditPlace;
  front.creditFormat = d.creditFormat || front.creditFormat;
  front.show = Object.assign({ title: false, caption: false, website: false, project: false, copyright: false, logo: false }, d.show);
  front.accent = d.accent || null;
  front.cancel = d.cancel !== undefined ? d.cancel : front.cancel;
  if (d.tagline && (front.tagline == null)) front.tagline = d.tagline;
}

/* Rebuild a card's back from a declarative back preset (preserves QR text). */
function applyBackPreset(card, presetId) {
  const keep = { qrOn: card.back.qrOn, qrText: card.back.qrText };
  card.back = defaultBack(presetId);
  Object.assign(card.back, keep);
  if (card.back.qrOn) ensureQrElement(card);
}

/* ═══════════════════ Timeline, photos & layout gallery ═══════════════════ */
const thumbCache = new Map();   /* cardId → dataURL */
const ICON = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;

function cardThumb(card) {
  const c = renderCardSide(card, 'front', 30, { export: false });
  return c.toDataURL('image/jpeg', 0.72);
}
const renderTimelineThumbSoon = debounce((idx) => {
  const card = state.cards[idx];
  if (!card) return;
  thumbCache.set(card.id, cardThumb(card));
  const img = $(`.tl-card[data-id="${card.id}"] img`);
  if (img) img.src = thumbCache.get(card.id);
}, 350);

function renderTimeline() {
  const tl = $('#timeline');
  tl.innerHTML = '';
  state.cards.forEach((card, i) => {
    if (!thumbCache.has(card.id)) thumbCache.set(card.id, cardThumb(card));
    const btn = document.createElement('div');
    btn.className = 'tl-card' + (i === state.sel ? ' selected' : '');
    btn.dataset.id = card.id;
    btn.tabIndex = 0;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', i === state.sel ? 'true' : 'false');
    btn.setAttribute('aria-label', `Card ${i + 1}: ${card.meta.title || card.name}`);
    btn.draggable = true;
    const img = document.createElement('img');
    img.src = thumbCache.get(card.id);
    img.alt = '';
    btn.appendChild(img);
    const num = document.createElement('span');
    num.className = 'tl-num'; num.textContent = i + 1;
    btn.appendChild(num);
    const actions = document.createElement('span');
    actions.className = 'tl-actions';
    const dup = document.createElement('button');
    dup.className = 'tl-act'; dup.title = 'Duplicate card'; dup.innerHTML = ICON('i-plus');
    dup.setAttribute('aria-label', `Duplicate card ${i + 1}`);
    dup.addEventListener('click', (e) => { e.stopPropagation(); duplicateCard(i); });
    const del = document.createElement('button');
    del.className = 'tl-act'; del.title = 'Remove card'; del.innerHTML = ICON('i-close');
    del.setAttribute('aria-label', `Remove card ${i + 1}`);
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteCard(i); });
    actions.append(dup, del);
    btn.appendChild(actions);
    btn.addEventListener('click', () => selectCard(i));
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(i); } });
    btn.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-card', String(i)); e.dataTransfer.effectAllowed = 'move'; });
    btn.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/x-card')) { e.preventDefault(); btn.classList.add('drag-over'); } });
    btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
    btn.addEventListener('drop', (e) => {
      const from = parseInt(e.dataTransfer.getData('text/x-card'), 10);
      btn.classList.remove('drag-over');
      if (!Number.isInteger(from)) return;
      e.preventDefault(); e.stopPropagation();
      if (from !== i) reorderCard(from, i);
    });
    tl.appendChild(btn);
  });
  $('#tlCount').textContent = state.cards.length ? `${state.cards.length} card${state.cards.length > 1 ? 's' : ''}` : '';
}

function renderMediaList() {
  const list = $('#mediaList');
  list.innerHTML = '';
  const cur = currentCard();
  for (const card of state.cards) {
    const im = imageStore.get(card.imageId);
    if (!im) continue;
    const btn = document.createElement('button');
    btn.className = 'media-item' + (card === cur ? ' current' : '');
    btn.dataset.card = card.id;
    btn.setAttribute('role', 'listitem');
    btn.title = im.name;
    btn.setAttribute('aria-label', `Go to the card for ${im.name}`);
    const img = document.createElement('img');
    img.src = im.thumb || im.dataURL; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    btn.appendChild(img);
    btn.addEventListener('click', () => selectCard(state.cards.indexOf(card)));
    list.appendChild(btn);
  }
}

/* Layout gallery — every layout drawn with the current card's own photo and
   words, so what you click is what you get. Thumbnails render in idle time. */
const tplState = { side: 'front', key: '', job: 0 };
function tplSide() { return tplState.side; }
function renderTemplates(force = false) {
  const grid = $('#tplGrid');
  if (!grid) return;
  const card = currentCard();
  const side = tplSide();
  const presets = side === 'front' ? FRONT_PRESETS : BACK_PRESETS;
  const { w: tw, h: th } = trimSize();
  const key = `${side}:${presets.length}:${tw}x${th}`;
  if (force || tplState.key !== key) {
    tplState.key = key;
    grid.innerHTML = '';
    for (const p of presets) {
      const b = document.createElement('button');
      b.className = 'tpl'; b.dataset.id = p.id; b.setAttribute('role', 'listitem');
      b.setAttribute('aria-label', `${p.name} layout`);
      b.innerHTML = `<span class="tpl-thumb"><span class="tpl-svg">${p.thumbnailSvg}</span></span><span class="tpl-name">${p.name}<span class="tpl-tag">${p.tag || ''}</span></span>`;
      b.addEventListener('click', () => applyTemplate(side, p.id));
      grid.appendChild(b);
    }
  }
  markActiveTemplate();
  if (!card) { $('#tplNote').textContent = 'Add a photo and every layout is previewed with it.'; return; }
  $('#tplNote').textContent = side === 'front' ? 'Previewed with your photo. Click one to use it.' : 'Previewed with your words. Click one to use it.';
  /* draw live thumbnails a few at a time so typing stays smooth */
  const job = ++tplState.job;
  const tiles = $$('.tpl', grid);
  const tileW = (tiles[0] && tiles[0].querySelector('.tpl-thumb').clientWidth) || 120;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ppi = Math.max(12, (tileW * 0.86 * dpr) / (tw + 0.001));
  let i = 0;
  const step = (deadline) => {
    if (job !== tplState.job) return;
    const t0 = performance.now();
    while (i < tiles.length && (deadline ? deadline.timeRemaining() > 4 : performance.now() - t0 < 12)) {
      const tile = tiles[i++];
      const id = tile.dataset.id;
      const clone = { ...card, meta: card.meta, front: deepClone(card.front), back: deepClone(card.back) };
      if (side === 'front') {
        if (id !== 'custom') applyFrontPreset(clone.front, id);
      } else {
        clone.back = defaultBack(id);
        if (card.back.qrOn) { clone.back.qrOn = true; clone.back.qrText = card.back.qrText; ensureQrElement(clone); }
      }
      const c = renderCardSide(clone, side, ppi, { export: false });
      c.style.width = (c.width / dpr) + 'px';
      const th_ = tile.querySelector('.tpl-thumb');
      th_.replaceChildren(c);
    }
    if (i < tiles.length) schedule(step);
  };
  const schedule = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(() => fn(null), 16));
  schedule(step);
}
const refreshTemplatesSoon = debounce(() => {
  if (isPanelVisible('templates')) renderTemplates();
}, 450);
function markActiveTemplate() {
  const card = currentCard();
  const side = tplSide();
  let active = null;
  if (card) active = side === 'front' ? frontStyle(card.front) : (BACK_PRESET_IDS.has(card.back.layout) ? card.back.layout : BACK_LAYOUT_ALIAS[card.back.layout] || card.back.layout);
  $$('#tplGrid .tpl').forEach(t => { const on = t.dataset.id === active; t.classList.toggle('active', on); t.setAttribute('aria-current', on ? 'true' : 'false'); });
}
function applyTemplate(side, id) {
  const card = currentCard();
  if (!card) { toast('Add a photo first, then choose a layout.'); return; }
  if (side === 'front') {
    applyFrontPreset(card.front, id);
    frontSel = null;
    if (id === 'split-diptych' && !card.imageId2) toast('This layout takes two photos — add the second one under Photo.');
    setSide('front');
    syncFrontInputs();
  } else {
    applyBackPreset(card, id);
    selectedEl = null;
    setSide('back');
    syncBackInputs(); syncElEditor();
  }
  commit();
  markActiveTemplate();
  renderTimelineThumbSoon(state.sel);
  view.needsRender = true;
}

function selectCard(i) {
  if (!state.cards.length) return;
  finishInlineEdit();
  state.sel = clamp(i, 0, state.cards.length - 1);
  selectedEl = null; frontSel = null;
  syncAllInputs(); renderTimeline(); renderMediaList();
  syncElEditor();
  refreshTemplatesSoon();
  view.needsRender = true;
  const el = $(`.tl-card[data-id="${state.cards[state.sel]?.id}"]`);
  if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function duplicateCard(i) {
  const copy = deepClone(state.cards[i]);
  copy.id = uid();
  copy.back.elements.forEach(e => { e.id = uid(); });
  state.cards.splice(i + 1, 0, copy);
  state.sel = i + 1;
  commit(); renderTimeline(); renderMediaList(); syncAllInputs(); view.needsRender = true;
  toast('Card duplicated.');
}

function deleteCard(i) {
  state.cards.splice(i, 1);
  state.sel = clamp(state.sel >= i ? state.sel - 1 : state.sel, 0, Math.max(0, state.cards.length - 1));
  selectedEl = null; frontSel = null;
  commit(); renderTimeline(); renderMediaList(); syncAllInputs(); refreshTemplatesSoon(); view.needsRender = true;
  toast('Card removed.', 5000, { label: 'Undo', fn: undo });
}

function reorderCard(from, to) {
  const [card] = state.cards.splice(from, 1);
  state.cards.splice(to, 0, card);
  state.sel = to;
  commit(); renderTimeline(); view.needsRender = true;
}

/* swap the current card's photo, keeping its layout and words */
async function replacePhoto(file) {
  const card = currentCard();
  if (!card || !file) return;
  await showProgress('Adding photo…');
  try {
    const id = await importPhotoFile(file);
    card.imageId = id;
    card.name = sanitizeName(file.name);
    card.front.tx = { x: 0, y: 0, zoom: 1, rot: 0 };
    const im = imageStore.get(id);
    if (im && im.exif) applyExifToCard(card, im.exif);
    commit(); syncAllInputs(); renderMediaList(); renderTimeline(); refreshTemplatesSoon(); view.needsRender = true;
    toast('Photo replaced.', 4000, { label: 'Undo', fn: undo });
  } catch (err) {
    console.error(err);
    toast('That file could not be opened as a photo.');
  } finally { hideProgress(); }
}

async function handleFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  await showProgress(`Importing ${files.length} photo${files.length > 1 ? 's' : ''}…`);
  try {
    const template = currentCard();   /* batch: new cards inherit the current design */
    let firstNew = -1;
    for (let i = 0; i < files.length; i++) {
      $('#progressText').textContent = `Importing ${i + 1} of ${files.length}…`;
      const id = await importPhotoFile(files[i]);
      const card = makeCard(id, files[i].name);
      const im = imageStore.get(id);
      if (im && im.exif) applyExifToCard(card, im.exif);
      if (template) {
        card.front = deepClone(template.front);
        card.front.tx = { x: 0, y: 0, zoom: 1, rot: 0 };
        card.back = deepClone(template.back);
        card.back.elements.forEach(e => { e.id = uid(); });
      }
      state.cards.push(card);
      if (firstNew < 0) firstNew = state.cards.length - 1;
    }
    state.sel = firstNew;
    commit(); renderTimeline(); renderMediaList(); syncAllInputs();
    zoomFit(); view.needsRender = true;
    toast(files.length === 1 ? 'Photo added.' : `${files.length} postcards created.`);
  } catch (err) {
    console.error(err);
    toast('Some photos could not be imported.');
  } finally {
    hideProgress();
  }
}

/* ═══════════════════ UI syncing ═══════════════════ */
let syncing = false;

function syncCardInputs() {
  $('#sizePreset').value = state.size.preset;
  $('#unitSel').value = state.size.unit;
  const u = state.size.unit;
  $('#customW').value = Math.round(inToUnit(state.size.w, u) * 100) / 100;
  $('#customH').value = Math.round(inToUnit(state.size.h, u) * 100) / 100;
  $('#orientLandscape').setAttribute('aria-pressed', state.size.orient === 'landscape');
  $('#orientLandscape').classList.toggle('active', state.size.orient === 'landscape');
  $('#orientPortrait').setAttribute('aria-pressed', state.size.orient === 'portrait');
  $('#orientPortrait').classList.toggle('active', state.size.orient === 'portrait');
  $('#bleedOn').checked = state.bleedOn;
  $('#marksOn').checked = state.marksOn;
  $('#safeOn').checked = state.safeOn;
  const { w, h } = trimSize();
  const px = Math.round((w + 2 * bleedIn()) * DPI), py = Math.round((h + 2 * bleedIn()) * DPI);
  $('#sizeInfo').textContent = `Trim ${fmtIn(w)} × ${fmtIn(h)} (${Math.round(w / MM)} × ${Math.round(h / MM)} mm) — exports at ${px} × ${py} px, 300 DPI.`;
  $('#gPhotographer').value = state.global.photographer;
  $('#gProject').value = state.global.project;
  $('#gWebsite').value = state.global.website;
  $('#gEmail').value = state.global.email;
  $('#gCopyright').value = state.global.copyright;
  $('#logoInfo').textContent = state.global.logoId ? 'Logo ready. Add it from Add → Logo, or tick “Show logo” on the front.' : 'No logo yet.';
  $('#customSizeRow').hidden = state.size.preset !== 'custom';
  const card = currentCard();
  $('#mLocation').value = card ? card.meta.location : '';
  $('#mDate').value = card ? card.meta.date : '';
  $('#mEdition').value = card ? card.meta.edition : '';
  $('#mCamera').value = card ? card.meta.camera : '';
}

function syncFrontInputs() {
  const card = currentCard();
  const f = card ? card.front : defaultFront();
  markActiveTemplate();
  const st = frontStyle(f);
  const preset = FRONT_PRESETS.find(p => p.id === st);
  const isDiptych = st === 'split-diptych';
  $('#diptychRow').hidden = !isDiptych;
  if (isDiptych) $('#diptychInfo').textContent = (card && card.imageId2) ? 'Second photo added.' : 'This layout shows two photos side by side.';
  /* layout colour swatches for layouts that use one */
  const usesAccent = !!(preset && preset.usesAccent);
  $('#accentRow').hidden = !usesAccent;
  if (usesAccent) {
    const wrap = $('#fAccentSwatches');
    const cols = preset.accents || [];
    const cur = f.accent || cols[0];
    if (wrap.dataset.for !== st) {
      wrap.dataset.for = st;
      wrap.innerHTML = '';
      for (const c of cols) {
        const b = document.createElement('button');
        b.className = 'swatch'; b.dataset.color = c; b.style.background = c; b.title = c; b.setAttribute('aria-label', 'Colour ' + c);
        b.addEventListener('click', () => { const cc = currentCard(); if (!cc) return; cc.front.accent = c; commit(); syncFrontInputs(); requestRender(); });
        wrap.appendChild(b);
      }
      const pick = document.createElement('input');
      pick.type = 'color'; pick.id = 'fAccent'; pick.title = 'Any colour'; pick.setAttribute('aria-label', 'Any colour');
      pick.addEventListener('input', (e) => { const cc = currentCard(); if (!cc || syncing) return; cc.front.accent = e.target.value; requestRender(); });
      pick.addEventListener('change', () => commit());
      wrap.appendChild(pick);
    }
    $$('.swatch', wrap).forEach(sw => sw.classList.toggle('active', sw.dataset.color === cur));
    $('#fAccent').value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#000000';
  }
  /* border controls only matter for the bordered layouts */
  const custom = !!FRONT_RENDERERS[st];
  const bordered = !custom || st === 'travel-poster' || st === 'editorial-cover';
  $('#fBorderSwatches').closest('.field').hidden = custom;
  $('#fBorderW').closest('.field').hidden = !bordered;
  $('#fBorderBottom').closest('.field').hidden = custom;
  $('#taglineRow').hidden = st !== 'greetings';
  $('#fTagline').value = f.tagline != null ? f.tagline : 'Greetings from';
  $('#fBorderW').value = f.borderW;
  $('#fBorderWOut').textContent = fmtIn(f.borderW);
  $('#fBorderBottom').value = f.borderBottom;
  $('#fBorderBottomOut').textContent = fmtIn(f.borderBottom);
  $('#fBorderColor').value = f.borderColor;
  $$('#fBorderSwatches .swatch').forEach(s => s.classList.toggle('active', s.dataset.color === f.borderColor));
  $('#fitFill').classList.toggle('active', f.fit === 'fill');
  $('#fitFill').setAttribute('aria-pressed', f.fit === 'fill');
  $('#fitFit').classList.toggle('active', f.fit === 'fit');
  $('#fitFit').setAttribute('aria-pressed', f.fit === 'fit');
  const cropId = (CROP_ASPECTS.find(a => a.ratio === f.cropAspect) || CROP_ASPECTS.find(a => a.ratio == null && !f.cropAspect) || { id: 'native' }).id;
  $$('#cropAspects .chip').forEach(ch => ch.classList.toggle('active', ch.dataset.id === (f.cropAspect ? cropId : 'native')));
  const a = f.adjust || { mode: 'none', exposure: 1, contrast: 1 };
  $$('#adjustModes .chip').forEach(ch => ch.classList.toggle('active', ch.dataset.id === a.mode));
  $('#fExposure').value = a.exposure ?? 1;
  $('#fExposureOut').textContent = ((a.exposure ?? 1) > 1 ? '+' : '') + Math.round(((a.exposure ?? 1) - 1) * 100);
  $('#fContrast').value = a.contrast ?? 1;
  $('#fContrastOut').textContent = ((a.contrast ?? 1) > 1 ? '+' : '') + Math.round(((a.contrast ?? 1) - 1) * 100);
  $('#fZoom').value = f.tx.zoom;
  $('#fZoomOut').textContent = Math.round(f.tx.zoom * 100) + '%';
  $('#fTitleOn').checked = f.show.title;
  $('#fCaptionOn').checked = f.show.caption;
  $('#fWebsiteOn').checked = f.show.website;
  $('#fProjectOn').checked = f.show.project;
  $('#fCopyrightOn').checked = f.show.copyright;
  $('#fLogoOn').checked = f.show.logo;
  $('#fTitle').value = card ? card.meta.title : '';
  $('#fCaption').value = card ? card.meta.caption : '';
  $('#btnReplacePhoto').textContent = card && card.imageId ? 'Replace…' : 'Add photo…';
  $('#creditPlace').value = f.creditPlace;
  $('#creditFormat').value = f.creditFormat;
  $('#creditCustomRow').hidden = f.creditFormat !== 'custom';
  $('#creditCustom').value = f.creditCustom;
}

function syncBackInputs() {
  const card = currentCard();
  const b = card ? card.back : defaultBack();
  markActiveTemplate();
  $('#bCaption').value = card ? card.meta.caption : '';
  $('#bStory').value = card ? card.meta.story : '';
  $('#bQrOn').checked = b.qrOn;
  $('#bQrText').value = b.qrText;
  $('#qrControls').hidden = !b.qrOn;
  const qe = qrElement(card);
  if (qe) {
    $('#qrSize').value = qe.w;
    $('#qrSizeOut').textContent = Math.round(qe.w * 100) + '%';
    $('#qrDark').value = qe.qrDark || '#1a1a1a';
    $('#qrLight').value = qe.qrLight || '#ffffff';
    const preset = qrPresetOf(qe);
    $('#qrPos').value = preset;
  }
  /* stamp style */
  const st = stampElement(card);
  const style = st ? (st.stampStyle || 'placeholder') : 'placeholder';
  $('#stampStyle').value = style;
  $('#stampImageRow').hidden = style !== 'image';
  $('#stampInfo').textContent = (st && st.stampImageId) ? 'Custom stamp image loaded.' : 'A square graphic works best (it is cropped to the stamp box).';
  /* postmark */
  const pm = postmarkElement(card);
  $('#bPostmarkOn').checked = !!pm;
  $('#postmarkControls').hidden = !pm;
  if (pm) {
    $('#pmCity').value = pm.city != null ? pm.city : '';
    $('#pmCity').placeholder = (card && card.meta.location) || 'Your Location';
    $('#pmDate').value = pm.date != null ? pm.date : '';
    $('#pmDate').placeholder = (card && card.meta.date) || '15 MAR 2026';
    $('#pmWaves').value = pm.waves ?? 5;
    $('#pmWavesOut').textContent = pm.waves ?? 5;
    $('#pmOpacity').value = pm.opacity ?? 0.85;
    $('#pmOpacityOut').textContent = Math.round((pm.opacity ?? 0.85) * 100) + '%';
    $('#pmBlend').checked = pm.blend !== 'normal';
    $$('#pmInks .swatch').forEach(s => s.classList.toggle('active', s.dataset.color === (pm.ink || '#3b4a56')));
  }
  renderElToggles();
}

/* which position preset (if any) the QR element currently matches */
const QR_PRESETS = { br: { x: 0.86, y: 0.66 }, bl: { x: 0.03, y: 0.66 }, tr: { x: 0.86, y: 0.06 }, tl: { x: 0.03, y: 0.06 } };
function qrPresetOf(el) {
  for (const [k, p] of Object.entries(QR_PRESETS)) {
    if (Math.abs(el.x - p.x) < 0.005 && Math.abs(el.y - p.y) < 0.005) return k;
  }
  return '';
}

function renderElToggles() {
  const wrap = $('#elToggles');
  wrap.innerHTML = '';
  const card = currentCard();
  if (!card) return;
  for (const el of card.back.elements) {
    if (el.type === 'qr' || el.type === 'postmark') continue;
    const label = el.type === 'text' && !el.bind ? `“${(el.text || '').slice(0, 14)}${(el.text || '').length > 14 ? '…' : ''}”` : (el.type === 'box' && el.label ? el.label.charAt(0) + el.label.slice(1).toLowerCase() : EL_LABELS[el.bind || el.type] || 'Element');
    const lab = document.createElement('label');
    lab.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = el.visible;
    cb.addEventListener('change', () => {
      el.visible = cb.checked;
      if (!el.visible && selectedEl === el) { selectedEl = null; syncElEditor(); }
      commit(); view.needsRender = true;
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(' ' + label));
    wrap.appendChild(lab);
  }
}

function syncElEditor() {
  const box = $('#elEditor');
  if (!selectedEl) { box.hidden = true; $('#backWordsHead').classList.add('first'); return; }
  box.hidden = false;
  $('#elName').textContent = EL_LABELS[selectedEl.bind || selectedEl.type] || 'Element';
  const isText = isTextual(selectedEl);
  $('#elTextRow').hidden = !isText;
  $('#elStyleRow').hidden = !(selectedEl.type === 'text' || selectedEl.type === 'box' || selectedEl.type === 'lines' || selectedEl.type === 'divider');
  if (isText) {
    $('#elText').value = elValue(currentCard(), selectedEl);
    buildTokenBar();
  }
  $('#elDup').disabled = ['qr', 'postmark', 'airmail'].includes(selectedEl.type);
  $('#elSize').value = selectedEl.size;
  $('#elFont').value = selectedEl.font;
  $('#elAlign').value = selectedEl.align;
  $('#elColor').value = /^#[0-9a-f]{6}$/i.test(selectedEl.color) ? selectedEl.color : '#2a2a2a';
  $('#elHide').textContent = (selectedEl.type === 'text' && !selectedEl.bind) ? 'Delete' : 'Hide';
  $('#backWordsHead').classList.remove('first');
}

/* quick-insert token chips in the Text Inspector */
function buildTokenBar() {
  const bar = $('#elTokens');
  if (bar.childElementCount) return;   /* build once, reused across selections */
  const label = document.createElement('span');
  label.className = 'token-label'; label.textContent = 'Insert';
  bar.appendChild(label);
  for (const t of TOKENS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'token-chip'; b.textContent = t.label;
    b.title = `Insert {${t.key}}`;
    b.addEventListener('click', () => insertToken(`{${t.key}}`));
    bar.appendChild(b);
  }
}
function insertToken(tok) {
  const ta = $('#elText');
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, s) + tok + ta.value.slice(e);
  const pos = s + tok.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function syncExportInputs() {
  const ex = state.export;
  $$('[data-expformat]').forEach(b => {
    const on = b.dataset.expformat === ex.format;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  $('#expSides').value = ex.sides;
  $('#expScope').value = ex.scope;
  $('#pdfMode').value = ex.pdfMode;
  $('#expEdge').value = ex.edge;
  $('#expBleed').checked = ex.bleed;
  $('#expMarks').checked = ex.marks;
  $('#namePattern').value = ex.pattern;
  $('#customPatternRow').hidden = ex.pattern !== 'custom';
  $('#customPattern').value = ex.custom;
  $('#pdfOptions').style.display = ex.format === 'pdf' ? '' : 'none';
  $('#duplexEdgeRow').style.display = ex.pdfMode.startsWith('sheet') ? '' : 'none';
  $('#projectFileName').value = state.projectName;
  updateExportSummary();
}

function updateExportSummary() {
  const ex = state.export;
  const n = ex.scope === 'current' ? (currentCard() ? 1 : 0) : state.cards.length;
  const sides = ex.sides === 'both' ? 2 : 1;
  const { w, h } = trimSize();
  const b = ex.bleed ? BLEED_IN * 2 : 0;
  const px = `${Math.round((w + b) * DPI)} × ${Math.round((h + b) * DPI)} px`;
  let what;
  if (ex.format === 'pdf') {
    what = ex.pdfMode === 'cards' ? `a PDF with ${n * sides} page${n * sides === 1 ? '' : 's'} at card size`
      : ex.pdfMode === 'contact' ? `a contact-sheet PDF of ${n} card${n === 1 ? '' : 's'}`
      : `a PDF of ${ex.pdfMode === 'sheet-letter' ? 'Letter' : 'A4'} sheets, backs mirrored for double-sided printing`;
  } else {
    const files = n * sides;
    what = files > 1 ? `${files} ${ex.format.toUpperCase()} files in a ZIP (${px} each, 300 DPI)` : `one ${ex.format.toUpperCase()} at ${px}, 300 DPI`;
  }
  $('#expSummary').textContent = n ? `You'll get ${what}.` : 'Add a card first.';
}

function syncAllInputs() {
  syncing = true;
  try {
    syncCardInputs(); syncFrontInputs(); syncBackInputs(); syncExportInputs();
  } finally { syncing = false; }
}

/* ═══════════════════ Input bindings ═══════════════════ */
function bindCardInputs() {
  const sel = $('#sizePreset');
  for (const p of SIZE_PRESETS) {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.label;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    const p = SIZE_PRESETS.find(x => x.id === sel.value);
    state.size.preset = p.id;
    if (p.id !== 'custom') { state.size.w = p.w; state.size.h = p.h; }
    if (p.id === 'square') state.size.orient = 'landscape';
    commit(); syncCardInputs(); zoomFit(); requestRender();
  });
  const setOrient = (o) => { state.size.orient = o; commit(); syncCardInputs(); zoomFit(); requestRender(); };
  $('#orientLandscape').addEventListener('click', () => setOrient('landscape'));
  $('#orientPortrait').addEventListener('click', () => setOrient('portrait'));
  const applyCustom = () => {
    if (syncing) return;
    const u = $('#unitSel').value;
    const w = parseFloat($('#customW').value), h = parseFloat($('#customH').value);
    if (!(w > 0.4) || !(h > 0.4)) return;
    state.size.unit = u;
    state.size.w = clamp(unitToIn(w, u), 1, 30);
    state.size.h = clamp(unitToIn(h, u), 1, 30);
    state.size.preset = 'custom';
    /* typed dimensions decide the orientation (otherwise 4 × 6 would flip back) */
    state.size.orient = state.size.w >= state.size.h ? 'landscape' : 'portrait';
    commit(); syncCardInputs(); zoomFit(); requestRender();
  };
  $('#customW').addEventListener('change', applyCustom);
  $('#customH').addEventListener('change', applyCustom);
  $('#unitSel').addEventListener('change', () => {
    state.size.unit = $('#unitSel').value;
    syncCardInputs();
  });
  $('#bleedOn').addEventListener('change', (e) => { state.bleedOn = e.target.checked; commit(); syncCardInputs(); zoomFit(); requestRender(); });
  $('#marksOn').addEventListener('change', (e) => { state.marksOn = e.target.checked; state.export.marks = e.target.checked; commit(); requestRender(); });
  $('#safeOn').addEventListener('change', (e) => { state.safeOn = e.target.checked; commit(); requestRender(); });

  const g = (id, key) => $(id).addEventListener('input', debounce((e) => {
    state.global[key] = e.target.value;
    commit(); requestRender();
  }, 350));
  g('#gPhotographer', 'photographer'); g('#gProject', 'project');
  g('#gWebsite', 'website'); g('#gEmail', 'email'); g('#gCopyright', 'copyright');

  const m = (id, key, alsoId) => $(id).addEventListener('input', debounce((e) => {
    const card = currentCard();
    if (!card) return;
    card.meta[key] = e.target.value;
    if (alsoId && document.activeElement !== $(alsoId)) $(alsoId).value = e.target.value;
    commit(); requestRender();
  }, 350));
  m('#mLocation', 'location'); m('#mDate', 'date');
  m('#mEdition', 'edition'); m('#mCamera', 'camera');

  $('#btnLogoUpload').addEventListener('click', () => $('#logoInput').click());
  $('#logoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataURL = await readFileAsDataURL(file);
    state.global.logoId = await addImageFromDataURL(dataURL, file.name);
    commit(); syncCardInputs(); requestRender();
    toast('Logo added. Put it on the back from Add → Logo, or tick “Show logo” on the front.');
    e.target.value = '';
  });
  $('#btnLogoClear').addEventListener('click', () => {
    state.global.logoId = null;
    commit(); syncCardInputs(); requestRender();
  });
}

function bindFrontInputs() {
  const front = () => currentCard() ? currentCard().front : null;

  /* crop aspect chips */
  const cropWrap = $('#cropAspects');
  for (const a of CROP_ASPECTS) {
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.id = a.id; b.textContent = a.label;
    b.addEventListener('click', () => {
      const f = front(); if (!f) return;
      f.cropAspect = a.ratio;
      commit(); syncFrontInputs(); requestRender();
    });
    cropWrap.appendChild(b);
  }
  /* tonal adjustment mode chips */
  const adjWrap = $('#adjustModes');
  for (const m of ADJUST_MODES) {
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.id = m.id; b.textContent = m.label;
    b.addEventListener('click', () => {
      const f = front(); if (!f) return;
      f.adjust = f.adjust || { mode: 'none', exposure: 1, contrast: 1 };
      f.adjust.mode = m.id;
      commit(); syncFrontInputs(); requestRender();
    });
    adjWrap.appendChild(b);
  }
  const adj = () => { const f = front(); if (!f) return null; f.adjust = f.adjust || { mode: 'none', exposure: 1, contrast: 1 }; return f.adjust; };
  $('#fExposure').addEventListener('input', (e) => {
    const a = adj(); if (!a || syncing) return;
    a.exposure = parseFloat(e.target.value);
    $('#fExposureOut').textContent = (a.exposure > 1 ? '+' : '') + Math.round((a.exposure - 1) * 100);
    requestRender();
  });
  $('#fExposure').addEventListener('change', commit);
  $('#fContrast').addEventListener('input', (e) => {
    const a = adj(); if (!a || syncing) return;
    a.contrast = parseFloat(e.target.value);
    $('#fContrastOut').textContent = (a.contrast > 1 ? '+' : '') + Math.round((a.contrast - 1) * 100);
    requestRender();
  });
  $('#fContrast').addEventListener('change', commit);
  $('#fAdjustReset').addEventListener('click', () => {
    const f = front(); if (!f) return;
    f.adjust = { mode: 'none', exposure: 1, contrast: 1 };
    commit(); syncFrontInputs(); requestRender();
  });

  $('#fBorderW').addEventListener('input', (e) => {
    const f = front(); if (!f || syncing) return;
    f.borderW = parseFloat(e.target.value);
    if (!FRONT_RENDERERS[frontStyle(f)]) { f.layout = 'custom'; f.style = 'custom'; markActiveTemplate(); }
    $('#fBorderWOut').textContent = fmtIn(f.borderW);
    requestRender();
  });
  $('#fBorderW').addEventListener('change', commit);
  $('#fBorderBottom').addEventListener('input', (e) => {
    const f = front(); if (!f || syncing) return;
    f.borderBottom = parseFloat(e.target.value); f.layout = 'custom'; f.style = 'custom'; markActiveTemplate();
    $('#fBorderBottomOut').textContent = fmtIn(f.borderBottom);
    requestRender();
  });
  $('#fBorderBottom').addEventListener('change', commit);
  $$('#fBorderSwatches .swatch').forEach(s => s.addEventListener('click', () => {
    const f = front(); if (!f) return;
    f.borderColor = s.dataset.color;
    commit(); syncFrontInputs(); requestRender();
  }));
  $('#fBorderColor').addEventListener('input', (e) => {
    const f = front(); if (!f || syncing) return;
    f.borderColor = e.target.value;
    requestRender();
  });
  $('#fBorderColor').addEventListener('change', commit);
  $('#fitFill').addEventListener('click', () => { const f = front(); if (f) { f.fit = 'fill'; commit(); syncFrontInputs(); requestRender(); } });
  $('#fitFit').addEventListener('click', () => { const f = front(); if (f) { f.fit = 'fit'; commit(); syncFrontInputs(); requestRender(); } });
  $('#fZoom').addEventListener('input', (e) => {
    const f = front(); if (!f || syncing) return;
    f.tx.zoom = parseFloat(e.target.value);
    $('#fZoomOut').textContent = Math.round(f.tx.zoom * 100) + '%';
    requestRender();
  });
  $('#fZoom').addEventListener('change', commit);
  $('#fRotL').addEventListener('click', () => { const f = front(); if (f) { f.tx.rot = (f.tx.rot + 270) % 360; commit(); requestRender(); } });
  $('#fRotR').addEventListener('click', () => { const f = front(); if (f) { f.tx.rot = (f.tx.rot + 90) % 360; commit(); requestRender(); } });
  $('#fReset').addEventListener('click', () => { const f = front(); if (f) { f.tx = { x: 0, y: 0, zoom: 1, rot: 0 }; commit(); syncFrontInputs(); requestRender(); } });

  /* replace the photo */
  $('#btnReplacePhoto').addEventListener('click', () => $('#replaceInput').click());
  $('#replaceInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!currentCard()) handleFiles([file]); else replacePhoto(file);
  });
  $('#fTagline').addEventListener('input', debounce((e) => {
    const card = currentCard(); if (!card) return;
    card.front.tagline = e.target.value;
    commit(); requestRender();
  }, 300));

  /* diptych: second photo */
  $('#btnDiptychUpload').addEventListener('click', () => $('#diptychInput').click());
  $('#diptychInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) { return; }
    const card = currentCard(); if (!card) { e.target.value = ''; return; }
    const id = await importPhotoFile(file);
    card.imageId2 = id;
    commit(); syncFrontInputs(); requestRender();
    toast('Second photo added to the diptych.');
    e.target.value = '';
  });
  $('#btnDiptychClear').addEventListener('click', () => {
    const card = currentCard(); if (!card) return;
    card.imageId2 = null;
    commit(); syncFrontInputs(); requestRender();
  });

  const show = (id, key) => $(id).addEventListener('change', (e) => {
    const f = front(); if (!f) return;
    f.show[key] = e.target.checked;
    commit(); requestRender();
  });
  show('#fTitleOn', 'title'); show('#fCaptionOn', 'caption'); show('#fWebsiteOn', 'website');
  show('#fProjectOn', 'project'); show('#fCopyrightOn', 'copyright'); show('#fLogoOn', 'logo');

  $('#fTitle').addEventListener('input', debounce((e) => {
    const card = currentCard(); if (!card) return;
    card.meta.title = e.target.value;
    commit(); requestRender();
  }, 300));
  $('#fCaption').addEventListener('input', debounce((e) => {
    const card = currentCard(); if (!card) return;
    card.meta.caption = e.target.value;
    if (document.activeElement !== $('#bCaption')) $('#bCaption').value = e.target.value;
    commit(); requestRender();
  }, 350));
  $('#creditPlace').addEventListener('change', (e) => { const f = front(); if (f) { f.creditPlace = e.target.value; commit(); requestRender(); } });
  $('#creditFormat').addEventListener('change', (e) => {
    const f = front(); if (!f) return;
    f.creditFormat = e.target.value;
    $('#creditCustomRow').hidden = f.creditFormat !== 'custom';
    commit(); requestRender();
  });
  $('#creditCustom').addEventListener('input', debounce((e) => {
    const f = front(); if (f) { f.creditCustom = e.target.value; commit(); requestRender(); }
  }, 350));

  $('#fApplyAll').addEventListener('click', () => {
    const card = currentCard(); if (!card) return;
    for (const c of state.cards) {
      if (c === card) continue;
      const tx = c.front.tx;
      c.front = deepClone(card.front);
      c.front.tx = tx;   /* keep each photo's own crop */
    }
    commit(); renderTimeline(); requestRender();
    toast(`Front layout used on all ${state.cards.length} cards.`, 4000, { label: 'Undo', fn: undo });
  });
}

function bindBackInputs() {
  $('#bCaption').addEventListener('input', debounce((e) => {
    const card = currentCard(); if (!card) return;
    card.meta.caption = e.target.value;
    if (document.activeElement !== $('#fCaption')) $('#fCaption').value = e.target.value;
    commit(); requestRender();
  }, 350));
  $('#bStory').addEventListener('input', debounce((e) => {
    const card = currentCard(); if (!card) return;
    card.meta.story = e.target.value;
    commit(); requestRender();
  }, 350));
  $('#bQrOn').addEventListener('change', (e) => {
    const card = currentCard(); if (!card) return;
    card.back.qrOn = e.target.checked;
    if (card.back.qrOn) {
      ensureQrElement(card);
      if (!card.back.qrText) card.back.qrText = state.global.website || '';
    } else {
      card.back.elements = card.back.elements.filter(el => el.type !== 'qr');
      if (selectedEl && selectedEl.type === 'qr') { selectedEl = null; syncElEditor(); }
    }
    commit(); syncBackInputs(); requestRender();
    if (card.back.qrOn) setSide('back');
  });
  $('#bQrText').addEventListener('input', debounce((e) => {
    const card = currentCard(); if (!card) return;
    card.back.qrText = e.target.value;
    commit(); requestRender();
  }, 400));
  $('#qrSize').addEventListener('input', (e) => {
    const qe = qrElement(currentCard()); if (!qe || syncing) return;
    qe.w = parseFloat(e.target.value); qe.h = qe.w;
    $('#qrSizeOut').textContent = Math.round(qe.w * 100) + '%';
    requestRender();
  });
  $('#qrSize').addEventListener('change', commit);
  $('#qrDark').addEventListener('input', (e) => { const qe = qrElement(currentCard()); if (qe) { qe.qrDark = e.target.value; requestRender(); } });
  $('#qrDark').addEventListener('change', commit);
  $('#qrLight').addEventListener('input', (e) => { const qe = qrElement(currentCard()); if (qe) { qe.qrLight = e.target.value; requestRender(); } });
  $('#qrLight').addEventListener('change', commit);
  $('#qrPos').addEventListener('change', (e) => {
    const qe = qrElement(currentCard()); const p = QR_PRESETS[e.target.value];
    if (qe && p) { qe.x = p.x; qe.y = p.y; commit(); requestRender(); }
  });

  /* ── stamp style & custom image ── */
  $('#stampStyle').addEventListener('change', (e) => {
    const card = currentCard(); if (!card) return;
    let st = stampElement(card);
    if (!st) { st = backElement('stamp', { x: 0.855, y: 0.055, w: 0.115, h: 0.24 }); card.back.elements.push(st); }
    st.stampStyle = e.target.value;
    if (e.target.value === 'image' && !st.stampImageId) $('#stampInput').click();
    commit(); syncBackInputs(); requestRender();
  });
  $('#btnStampUpload').addEventListener('click', () => $('#stampInput').click());
  $('#stampInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const card = currentCard(); if (!card) { e.target.value = ''; return; }
    const dataURL = await readFileAsDataURL(file);
    const id = await addImageFromDataURL(dataURL, file.name);
    let st = stampElement(card);
    if (!st) { st = backElement('stamp', { x: 0.855, y: 0.055, w: 0.115, h: 0.24 }); card.back.elements.push(st); }
    st.stampImageId = id; st.stampStyle = 'image';
    commit(); syncBackInputs(); requestRender();
    toast('Custom stamp image added.');
    e.target.value = '';
  });
  $('#btnStampClear').addEventListener('click', () => {
    const st = stampElement(currentCard());
    if (st) { st.stampImageId = null; st.stampStyle = 'placeholder'; commit(); syncBackInputs(); requestRender(); }
  });

  /* ── postmark ── */
  const pmInks = $('#pmInks');
  for (const ink of POSTMARK_INKS) {
    const s = document.createElement('button');
    s.className = 'swatch'; s.dataset.color = ink.color; s.style.background = ink.color;
    s.title = ink.label; s.setAttribute('aria-label', ink.label + ' ink');
    s.addEventListener('click', () => {
      const pm = postmarkElement(currentCard()); if (!pm) return;
      pm.ink = ink.color; commit(); syncBackInputs(); requestRender();
    });
    pmInks.appendChild(s);
  }
  $('#bPostmarkOn').addEventListener('change', (e) => {
    const card = currentCard(); if (!card) return;
    if (e.target.checked) ensurePostmark(card);
    else {
      card.back.elements = card.back.elements.filter(el => el.type !== 'postmark');
      if (selectedEl && selectedEl.type === 'postmark') { selectedEl = null; syncElEditor(); }
    }
    commit(); syncBackInputs(); requestRender();
    if (e.target.checked) setSide('back');
  });
  const pmField = (id, key, isNum) => $(id).addEventListener('input', debounce((e) => {
    const pm = postmarkElement(currentCard()); if (!pm) return;
    pm[key] = isNum ? parseFloat(e.target.value) : e.target.value;
    if (key === 'waves') $('#pmWavesOut').textContent = pm.waves;
    if (key === 'opacity') $('#pmOpacityOut').textContent = Math.round(pm.opacity * 100) + '%';
    commit(); requestRender();
  }, 250));
  pmField('#pmCity', 'city'); pmField('#pmDate', 'date');
  pmField('#pmWaves', 'waves', true); pmField('#pmOpacity', 'opacity', true);
  $('#pmBlend').addEventListener('change', (e) => {
    const pm = postmarkElement(currentCard()); if (!pm) return;
    pm.blend = e.target.checked ? 'multiply' : 'normal';
    commit(); requestRender();
  });

  /* selected element editor */
  $('#elText').addEventListener('input', debounce((e) => {
    if (!selectedEl || !isTextual(selectedEl)) return;
    const card = currentCard();
    setElValue(card, selectedEl, e.target.value);
    commit(); requestRender();
  }, 350));
  $('#elSize').addEventListener('input', (e) => {
    if (!selectedEl) return;
    selectedEl.size = clamp(parseFloat(e.target.value) || 9, 4, 96);
    requestRender();
  });
  $('#elSize').addEventListener('change', commit);
  $('#elFont').addEventListener('change', (e) => { if (selectedEl) { selectedEl.font = e.target.value; commit(); requestRender(); } });
  $('#elAlign').addEventListener('change', (e) => { if (selectedEl) { selectedEl.align = e.target.value; commit(); requestRender(); } });
  $('#elColor').addEventListener('input', (e) => { if (selectedEl) { selectedEl.color = e.target.value; requestRender(); } });
  $('#elColor').addEventListener('change', commit);
  $('#elHide').addEventListener('click', () => {
    if (!selectedEl) return;
    const card = currentCard();
    if (selectedEl.type === 'text' && !selectedEl.bind && card) {
      /* custom text elements are simply removed */
      card.back.elements = card.back.elements.filter(el => el !== selectedEl);
    } else {
      selectedEl.visible = false;
    }
    selectedEl = null;
    commit(); syncBackInputs(); syncElEditor(); requestRender();
  });
  $('#bAddText').addEventListener('click', () => addToBack('text'));
  $('#elDup').addEventListener('click', duplicateSelected);
  $$('[data-add]').forEach(b => b.addEventListener('click', () => addToBack(b.dataset.add)));
  $('#elDeselect').addEventListener('click', () => { selectedEl = null; syncElEditor(); requestRender(); });

  $('#bApplyAll').addEventListener('click', () => {
    const card = currentCard(); if (!card) return;
    for (const c of state.cards) {
      if (c === card) continue;
      c.back = deepClone(card.back);
      c.back.elements.forEach(el => { el.id = uid(); });
    }
    commit(); renderTimeline(); requestRender();
    toast(`Back layout used on all ${state.cards.length} cards.`, 4000, { label: 'Undo', fn: undo });
  });
}

/* Add something from the Add panel to the back of the current card */
function addToBack(kind) {
  const card = currentCard();
  if (!card) { toast('Add a photo first — then you can add things to the back.'); return; }
  let el = null;
  const els = card.back.elements;
  switch (kind) {
    case 'text': el = backElement('text', { x: 0.08, y: 0.4, w: 0.36, h: 0.12, text: 'Your words', size: 10 }); break;
    case 'heading': el = backElement('text', { x: 0.06, y: 0.08, w: 0.42, h: 0.16, text: 'A heading', size: 22, font: 'editorial', lineHeight: 1.05 }); break;
    case 'note': el = backElement('text', { x: 0.08, y: 0.3, w: 0.36, h: 0.2, text: 'Wish you were here', size: 18, font: 'editorial', style: 'italic', color: '#2a4d8f', lineHeight: 1.1 }); break;
    case 'lines': el = backElement('lines', { x: 0.05, y: 0.3, w: 0.41, h: 0.5, lines: 6, color: '#cfc9bd' }); break;
    case 'divider': el = backElement('divider', { x: 0.5, y: 0.08, w: 0.0035, h: 0.84 }); break;
    case 'logo': {
      el = backElement('logo', { x: 0.05, y: 0.78, w: 0.16, h: 0.13 });
      if (!state.global.logoId) { $('#logoInput').click(); }
      break;
    }
    case 'stamp': {
      const st = els.find(e => e.type === 'stamp');
      if (st) { st.visible = true; selectedEl = st; commit(); syncBackInputs(); syncElEditor(); setSide('back'); toast('The stamp box is already on this card.'); return; }
      el = backElement('stamp', { x: 0.855, y: 0.055, w: 0.115, h: 0.24 });
      break;
    }
    case 'postmark': {
      el = ensurePostmark(card);
      el.visible = true;
      selectedEl = el;
      commit(); syncBackInputs(); syncElEditor(); setSide('back');
      return;
    }
    case 'qr': {
      card.back.qrOn = true;
      ensureQrElement(card);
      if (!card.back.qrText) card.back.qrText = state.global.website || '';
      selectedEl = qrElement(card);
      commit(); syncBackInputs(); syncElEditor(); setSide('back');
      openInspPage('back');
      if (!card.back.qrText) { toast('Type the web address for the QR code under Back → QR code.'); if (!isNarrow()) $('#bQrText').focus(); }
      return;
    }
  }
  if (!el) return;
  els.push(el);
  selectedEl = el;
  commit(); syncBackInputs(); syncElEditor();
  setSide('back');
  if (isNarrow()) closeSheets();
}

function ensureQrElement(card) {
  if (!card.back.elements.some(e => e.type === 'qr')) {
    card.back.elements.push(backElement('qr', { x: 0.86, y: 0.66, w: 0.11, h: 0.11, qrDark: '#1a1a1a', qrLight: '#ffffff' }));
  }
}
function qrElement(card) { return card ? card.back.elements.find(e => e.type === 'qr') : null; }
function postmarkElement(card) { return card ? card.back.elements.find(e => e.type === 'postmark') : null; }
function stampElement(card) { return card ? card.back.elements.find(e => e.type === 'stamp') : null; }
function ensurePostmark(card) {
  let el = postmarkElement(card);
  if (!el) {
    el = backElement('postmark', { x: 0.55, y: 0.06, w: 0.4, h: 0.2, ink: '#3b4a56', city: null, date: null, blend: 'multiply', opacity: 0.85, waves: 5 });
    card.back.elements.push(el);
  }
  return el;
}

function bindExportInputs() {
  $$('[data-expformat]').forEach(b => b.addEventListener('click', () => {
    state.export.format = b.dataset.expformat;
    commit(); syncExportInputs();
  }));
  const ex = (id, key, cb) => $(id).addEventListener('change', (e) => {
    state.export[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    commit(); syncExportInputs();
    if (cb) cb();
  });
  ex('#expSides', 'sides'); ex('#expScope', 'scope');
  ex('#pdfMode', 'pdfMode', () => { if (state.ui.view === 'sheet') requestRender(); });
  ex('#expEdge', 'edge'); ex('#expBleed', 'bleed'); ex('#expMarks', 'marks');
  ex('#namePattern', 'pattern');
  $('#customPattern').addEventListener('input', debounce((e) => { state.export.custom = e.target.value; commit(); }, 400));
  $('#projectFileName').addEventListener('input', debounce((e) => { state.projectName = e.target.value || 'project'; commit(); }, 400));

  $('#btnExport').addEventListener('click', async () => { await runExport(); });
  $('#btnPrint').addEventListener('click', runPrint);
  $('#btnDuplexPreview').addEventListener('click', () => {
    renderDuplexPreview();
    $('#dlgDuplex').showModal();
  });

  /* project save / restore */
  $('#btnSaveProject').addEventListener('click', () => {
    const data = serializeProject();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    downloadBlob(blob, sanitizeName(state.projectName) + '.postcard');
    toast('Project exported as a .postcard archive.');
  });
  $('#btnLoadProject').addEventListener('click', () => $('#projectInput').click());
  $('#projectInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await restoreProjectFile(file);
    e.target.value = '';
  });

  /* design presets (localStorage) */
  const PRESET_KEY = 'postcard-press-presets';
  const loadPresets = () => { try { return JSON.parse(localStorage.getItem(PRESET_KEY)) || {}; } catch { return {}; } };
  const savePresets = (p) => { try { localStorage.setItem(PRESET_KEY, JSON.stringify(p)); } catch {} };
  const renderPresets = () => {
    const wrap = $('#presetList');
    wrap.innerHTML = '';
    const presets = loadPresets();
    for (const name of Object.keys(presets)) {
      const row = document.createElement('div');
      row.className = 'preset-item';
      const apply = document.createElement('button');
      apply.className = 'btn btn-ghost'; apply.textContent = name;
      apply.title = `Apply preset “${name}”`;
      apply.addEventListener('click', () => {
        const p = presets[name];
        state.size = deepClone(p.size);
        state.global = Object.assign(state.global, deepClone(p.global), { logoId: state.global.logoId });
        const card = currentCard();
        if (card) {
          card.front = deepClone(p.front);
          card.back = deepClone(p.back);
          card.back.elements.forEach(el => { el.id = uid(); });
        }
        commit(); syncAllInputs(); zoomFit(); requestRender();
        toast(`Preset “${name}” applied to this card.`);
      });
      const del = document.createElement('button');
      del.className = 'icon-btn sm'; del.textContent = '✕';
      del.setAttribute('aria-label', `Delete preset ${name}`);
      del.addEventListener('click', () => {
        const p = loadPresets();
        delete p[name];
        savePresets(p); renderPresets();
      });
      row.append(apply, del);
      wrap.appendChild(row);
    }
  };
  $('#btnSavePreset').addEventListener('click', () => {
    const name = $('#presetName').value.trim();
    if (!name) { toast('Give the preset a name first.'); return; }
    const card = currentCard();
    if (!card) { toast('Add a postcard first.'); return; }
    const presets = loadPresets();
    presets[name] = {
      size: deepClone(state.size),
      global: { photographer: state.global.photographer, project: state.global.project, website: state.global.website, email: state.global.email, copyright: state.global.copyright },
      front: deepClone(card.front),
      back: deepClone(card.back),
    };
    savePresets(presets); renderPresets();
    $('#presetName').value = '';
    toast(`Preset “${name}” saved.`);
  });
  renderPresets();
}

/* ═══════════════════ App chrome ═══════════════════ */
function syncSideUi() {
  const side = state.ui.side;
  $$('.insp-tab').forEach(t => {
    const on = t.dataset.page === side;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  });
  $$('.insp-page').forEach(p => p.classList.toggle('active', p.dataset.page === side));
  $$('.view-seg [data-view]').forEach(b => {
    const on = b.dataset.view === state.ui.view;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  /* the layout gallery follows the side being edited */
  if (tplState.side !== side) { tplState.side = side; syncTplSeg(); if (isPanelVisible('templates')) renderTemplates(); }
}
function setSide(side) {
  finishInlineEdit();
  state.ui.side = side;
  if (state.ui.view === 'front' || state.ui.view === 'back') state.ui.view = side;
  if (side === 'front' && selectedEl) { selectedEl = null; syncElEditor(); }
  if (side === 'back') frontSel = null;
  syncSideUi();
  view.needsRender = true;
}
function setView(v) {
  finishInlineEdit();
  state.ui.view = v;
  if (v === 'front' || v === 'back') state.ui.side = v;
  if (v === 'sheet') { selectedEl = null; frontSel = null; syncElEditor(); }
  syncSideUi();
  zoomFit();
}
function openInspPage(page) {
  if (page === 'front' || page === 'back') setSide(page);
}

function setTheme(t, save = true) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') || (() => { const m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); return m; })();
  meta.content = t === 'dark' ? '#171614' : '#f4f1ea';
  if (save) { try { localStorage.setItem('postcard-press-theme', t); } catch {} }
}

/* ── panels: left drawer on desktop; one bottom sheet at a time on phones ── */
let activePanel = 'templates';
function isPanelVisible(name) {
  if (name !== activePanel) return false;
  return isNarrow() ? $('#drawer').classList.contains('open') : !$('#app').classList.contains('fullscreen-preview');
}
function syncTplSeg() {
  $('#tplFront').classList.toggle('active', tplState.side === 'front');
  $('#tplFront').setAttribute('aria-pressed', tplState.side === 'front');
  $('#tplBack').classList.toggle('active', tplState.side === 'back');
  $('#tplBack').setAttribute('aria-pressed', tplState.side === 'back');
}
function showPanel(name) {
  const narrow = isNarrow();
  if (narrow) {
    const sheetOpen = name === 'edit' ? $('#inspector').classList.contains('open') : ($('#drawer').classList.contains('open') && activePanel === name);
    closeSheets();
    if (sheetOpen) { setRailActive(null); return; }   /* tapping the active tab again closes it */
    if (name === 'edit') { $('#inspector').classList.add('open'); setRailActive('edit'); view.needsRender = true; return; }
    $('#drawer').classList.add('open');
  }
  activePanel = name;
  $$('.dpanel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  setRailActive(name);
  if (name === 'templates') renderTemplates();
  if (name === 'photos') renderMediaList();
  view.needsRender = true;
}
function syncSheetClass() {
  $('#app').classList.toggle('sheet-open', isNarrow() && ($('#drawer').classList.contains('open') || $('#inspector').classList.contains('open')));
}
function setRailActive(name) {
  syncSheetClass();
  $$('.rail-btn').forEach(b => { const on = b.dataset.panel === name; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
}
function closeSheets() {
  $('#drawer').classList.remove('open');
  $('#inspector').classList.remove('open');
  if (isNarrow()) setRailActive(null);
  syncSheetClass();
  view.needsRender = true;
}
/* kept for older call sites */
function openMobilePanel(which) { showPanel(which === 'media' ? 'photos' : 'edit'); }
function closeMobilePanels() { closeSheets(); }

function openExport() {
  finishInlineEdit();
  syncExportInputs();
  $('#dlgExport').showModal();
}

function bindChrome() {
  $$('.view-seg [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('.insp-tab').forEach(t => t.addEventListener('click', () => setSide(t.dataset.page)));
  $('#btnFlip').addEventListener('click', () => setSide(state.ui.side === 'front' ? 'back' : 'front'));
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnTheme').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  $('#btnGuides').addEventListener('click', () => {
    state.ui.guides = !state.ui.guides;
    $('#btnGuides').setAttribute('aria-pressed', state.ui.guides);
    view.needsRender = true;
  });
  $('#btnFullscreen').addEventListener('click', () => {
    $('#app').classList.toggle('fullscreen-preview');
    $('#btnFullscreen').setAttribute('aria-pressed', $('#app').classList.contains('fullscreen-preview'));
    setTimeout(zoomFit, 30);
  });
  $('#btnExportOpen').addEventListener('click', openExport);
  $('#brandHome').addEventListener('click', (e) => { e.preventDefault(); zoomFit(); });

  /* rail / tab bar */
  $$('.rail-btn').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  $$('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheets));
  $('#tplFront').addEventListener('click', () => { tplState.side = 'front'; syncTplSeg(); renderTemplates(); if (state.ui.view !== 'both') setSide('front'); });
  $('#tplBack').addEventListener('click', () => { tplState.side = 'back'; syncTplSeg(); renderTemplates(); if (state.ui.view !== 'both') setSide('back'); });

  /* zoom hud */
  $('#btnZoomIn').addEventListener('click', () => setZoom(view.zoom * 1.25));
  $('#btnZoomOut').addEventListener('click', () => setZoom(view.zoom / 1.25));
  $('#btnZoomFit').addEventListener('click', zoomFit);
  $('#btnZoom100').addEventListener('click', zoomActual);
  $('#zoomLevel').addEventListener('click', zoomFit);

  /* uploads */
  const openPicker = () => $('#fileInput').click();
  $('#dropzone').addEventListener('click', openPicker);
  $('#btnUploadSm').addEventListener('click', openPicker);
  $('#btnEmptyUpload').addEventListener('click', openPicker);
  $('#btnAddCard').addEventListener('click', openPicker);
  $('#fileInput').addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
  $('#btnDemo').addEventListener('click', loadDemoProject);
  $('#btnEmptyDemo').addEventListener('click', loadDemoProject);

  /* drag & drop: a .postcard file restores a project; one photo dropped on
     the card replaces its picture; anything else becomes new cards */
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); dragDepth++; $('#dropzone').classList.add('dragover'); $('#previewArea').classList.add('dragover'); });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropzone').classList.remove('dragover'); $('#previewArea').classList.remove('dragover'); } });
  window.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
    dragDepth = 0;
    $('#dropzone').classList.remove('dragover'); $('#previewArea').classList.remove('dragover');
    if (!files.length) return;
    e.preventDefault();
    const project = files.find(f => /\.postcard$/i.test(f.name) || /\.json$/i.test(f.name) || f.type === 'application/json');
    if (project) { restoreProjectFile(project); return; }
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length === 1 && currentCard()) {
      const rect = viewport.getBoundingClientRect();
      const hit = toCardCoords(e.clientX - rect.left, e.clientY - rect.top);
      if (hit && hit.item.side === 'front') { replacePhoto(imgs[0]); return; }
    }
    handleFiles(files);
  });

  /* dialogs */
  $$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  /* duplex dialog */
  const dupSync = () => {
    $('#dupLong').classList.toggle('active', duplex.edge === 'long');
    $('#dupLong').setAttribute('aria-pressed', duplex.edge === 'long');
    $('#dupShort').classList.toggle('active', duplex.edge === 'short');
    $('#dupShort').setAttribute('aria-pressed', duplex.edge === 'short');
    $('#dupA4').classList.toggle('active', duplex.sheet === 'a4');
    $('#dupA4').setAttribute('aria-pressed', duplex.sheet === 'a4');
    $('#dupLetter').classList.toggle('active', duplex.sheet === 'letter');
    $('#dupLetter').setAttribute('aria-pressed', duplex.sheet === 'letter');
    renderDuplexPreview();
  };
  $('#dupLong').addEventListener('click', () => { duplex.edge = 'long'; dupSync(); });
  $('#dupShort').addEventListener('click', () => { duplex.edge = 'short'; dupSync(); });
  $('#dupA4').addEventListener('click', () => { duplex.sheet = 'a4'; dupSync(); });
  $('#dupLetter').addEventListener('click', () => { duplex.sheet = 'letter'; dupSync(); });
  $('#dupGuides').addEventListener('change', (e) => { duplex.guides = e.target.checked; renderDuplexPreview(); });
  $('#btnTestPrint').addEventListener('click', () => printCanvases(alignmentTestCanvases(duplex.sheet, duplex.edge), 200, duplex.sheet === 'letter' ? 'letter' : 'A4'));
  $('#btnDuplexPrint').addEventListener('click', async () => {
    await ensureFonts();
    const opts = { bleed: state.bleedOn, marks: state.marksOn, edge: duplex.edge, export: true };
    const L = sheetLayout(duplex.sheet, opts);
    const canvases = [];
    for (let start = 0; start < state.cards.length; start += L.per) {
      const batch = state.cards.slice(start, start + L.per);
      canvases.push(renderSheet(batch, duplex.sheet, 'front', 200, opts));
      canvases.push(renderSheet(batch, duplex.sheet, 'back', 200, opts));
    }
    $('#dlgDuplex').close();
    await printCanvases(canvases, 200, duplex.sheet === 'letter' ? 'letter' : 'A4');
  });

  /* keyboard shortcuts */
  const nudgeCommit = debounce(commit, 500);
  window.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); $('#btnSaveProject').click(); return; }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); runPrint(); return; }
    if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); openExport(); return; }
    if (typing || document.querySelector('dialog[open]')) return;
    if (mod && e.key.toLowerCase() === 'd' && selectedEl) { e.preventDefault(); duplicateSelected(); return; }
    if (e.key === 'Enter') {
      if (selectedEl && isTextual(selectedEl)) { e.preventDefault(); startInlineEdit({ el: selectedEl }); return; }
      if (frontSel && frontSel !== 'photo') { e.preventDefault(); startInlineEdit({ front: frontSel }); return; }
    }
    if (selectedEl && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 0.02 : 0.004;
      if (e.key === 'ArrowLeft') selectedEl.x = clamp(selectedEl.x - step, -0.05, 0.98);
      if (e.key === 'ArrowRight') selectedEl.x = clamp(selectedEl.x + step, -0.05, 0.98);
      if (e.key === 'ArrowUp') selectedEl.y = clamp(selectedEl.y - step, -0.05, 0.98);
      if (e.key === 'ArrowDown') selectedEl.y = clamp(selectedEl.y + step, -0.05, 0.98);
      nudgeCommit();
      view.needsRender = true;
      return;
    }
    if (mod) return;
    switch (e.key) {
      case '1': zoomActual(); break;
      case '0': zoomFit(); break;
      case '+': case '=': setZoom(view.zoom * 1.25); break;
      case '-': setZoom(view.zoom / 1.25); break;
      case 'f': case 'F': setSide('front'); break;
      case 'b': case 'B': setSide('back'); break;
      case 'g': case 'G': $('#btnGuides').click(); break;
      case 't': case 'T': $('#btnTheme').click(); break;
      case 'ArrowLeft': if (state.cards.length) selectCard(state.sel - 1); break;
      case 'ArrowRight': if (state.cards.length) selectCard(state.sel + 1); break;
      case 'Delete': case 'Backspace':
        if (selectedEl) { e.preventDefault(); $('#elHide').click(); }
        break;
      case 'Escape':
        if (selectedEl || frontSel) { selectedEl = null; frontSel = null; syncElEditor(); view.needsRender = true; }
        else if ($('#app').classList.contains('fullscreen-preview')) $('#btnFullscreen').click();
        else if (isNarrow()) closeSheets();
        break;
    }
  });

  /* re-fit on resize / rotation; move between desktop and phone layouts */
  let wasNarrow = isNarrow();
  const ro = new ResizeObserver(() => {
    if (view.fitMode) { view.panX = 0; view.panY = 0; }
    view.needsRender = true;
    const n = isNarrow();
    if (n !== wasNarrow) {
      wasNarrow = n;
      closeSheets();
      if (!n) showPanel(activePanel === 'edit' ? 'templates' : activePanel);
    }
  });
  ro.observe(viewport);
}

/* ═══════════════════ Init ═══════════════════ */
async function init() {
  let theme = null;
  try { theme = localStorage.getItem('postcard-press-theme'); } catch {}
  if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(theme, false);

  bindChrome();
  bindCardInputs();
  bindFrontInputs();
  bindBackInputs();
  bindExportInputs();
  bindInlineEditor();

  try {
    if (await loadAutosave()) toast('Picked up where you left off.');
  } catch (e) { console.warn('Autosave restore skipped:', e); }

  if (!history.stack.length) { history.stack = [snapshot()]; history.idx = 0; }
  updateUndoButtons();
  syncAllInputs();
  syncSideUi();
  renderTimeline();
  renderMediaList();
  if (!isNarrow()) showPanel('templates'); else setRailActive(null);
  zoomFit();
  previewLoop();

  /* fetch the bundled card fonts after the page has settled, then redraw
     anything that was drawn with a fallback face */
  const warmFonts = () => ensureFonts().then(() => { thumbCache.clear(); renderTimeline(); renderTemplates(true); view.needsRender = true; });
  if (state.cards.length) warmFonts();
  else {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    window.addEventListener('load', () => idle(warmFonts, { timeout: 4000 }), { once: true });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);

/* Test hooks — lets automated tests drive the app; harmless in production. */
window.PostcardPress = {
  state, imageStore, loadDemoProject, renderCardSide, renderSheet, renderContactSheet,
  buildCardsPdf, buildSheetPdf, buildContactPdf, canvasToBytes, makeZip, QR,
  serializeProject, loadProjectData, handleFiles, selectCard, setSide, setView,
  requestRender, zoomFit,
  extractExif, applyExifToCard, applyTokens, tokenValue, qrMatrix, drawQr, currentCard,
  ensurePostmark, postmarkElement, stampElement, restoreProjectFile,
  adjustFilter, adjustTint, CROP_ASPECTS, ADJUST_MODES,
  FRONT_PRESETS, BACK_PRESETS, applyFrontPreset, applyBackPreset, frontStyle, defaultBack, normalizeCard,
  ensureFonts, loadQrLib, addToBack, replacePhoto, deleteCard, undo, redo, startInlineEdit, finishInlineEdit,
  renderTemplates, showPanel, referencedImageIds, view, bindTextReal,
  get selectedEl() { return selectedEl; }, set selectedEl(v) { selectedEl = v; },
  get frontSel() { return frontSel; },
  printCanvasesForTest: (c) => printCanvases([c], 200, null),
};
