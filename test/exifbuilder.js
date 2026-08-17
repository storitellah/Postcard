// Build an EXIF APP1 segment (little-endian TIFF) with the tags we care about.
// Exported for reuse in the browser test.
function buildExifApp1({ make, model, lens, focal, fnum, exp, iso, date }) {
  const data = []; // data area bytes (after IFDs), offsets are from TIFF start (II)
  const enc = (s) => { const b = []; for (let i=0;i<s.length;i++) b.push(s.charCodeAt(i)&0xff); b.push(0); return b; };
  // We'll compute layout: TIFF header(8) + IFD0 + EXIF IFD + data area.
  const ascii = {};
  const rational = {};
  // placeholders; we compute offsets after knowing sizes.
  // IFD0 entries: Make, Model, ExifPointer
  // EXIF entries: ExposureTime, FNumber, ISO, DateTimeOriginal, FocalLength, LensModel
  const ifd0Count = 3, exifCount = 6;
  const ifd0Start = 8;
  const ifd0Size = 2 + ifd0Count*12 + 4;
  const exifStart = ifd0Start + ifd0Size;
  const exifSize = 2 + exifCount*12 + 4;
  let dataOff = exifStart + exifSize; // where big values begin
  const bytes = [];
  const pushU16 = (arr,v)=>{arr.push(v&0xff,(v>>8)&0xff);};
  const pushU32 = (arr,v)=>{arr.push(v&0xff,(v>>8)&0xff,(v>>16)&0xff,(v>>24)&0xff);};
  // data area accumulation
  const dataArea = [];
  const addAscii = (s)=>{ const b=enc(s); const off=dataOff+dataArea.length; for(const x of b) dataArea.push(x); if(dataArea.length%2) dataArea.push(0); return {count:b.length, off}; };
  const addRational = (num,den)=>{ const off=dataOff+dataArea.length; pushU32(dataArea,num); pushU32(dataArea,den); return {count:1, off}; };
  const makeV = addAscii(make), modelV = addAscii(model), lensV = addAscii(lens), dateV = addAscii(date);
  const focalV = addRational(Math.round(focal*10),10), fnumV = addRational(Math.round(fnum*10),10), expV = addRational(1, Math.round(1/exp));
  // TIFF header
  bytes.push(0x49,0x49, 0x2A,0x00); pushU32(bytes,8);
  // IFD0
  pushU16(bytes, ifd0Count);
  const entry=(tag,type,count,valOff)=>{ pushU16(bytes,tag); pushU16(bytes,type); pushU32(bytes,count); if(type===2||type===5){ pushU32(bytes,valOff);} else { // inline
      // for SHORT single value store in low 2 bytes
      bytes.push(valOff&0xff,(valOff>>8)&0xff,0,0);
    } };
  entry(0x010F,2,makeV.count,makeV.off);
  entry(0x0110,2,modelV.count,modelV.off);
  entry(0x8769,4,1,exifStart);
  pushU32(bytes,0); // next IFD
  // EXIF IFD
  pushU16(bytes, exifCount);
  entry(0x829A,5,1,expV.off);   // ExposureTime RATIONAL
  entry(0x829D,5,1,fnumV.off);  // FNumber RATIONAL
  entry(0x8827,3,1,iso);        // ISO SHORT inline
  entry(0x9003,2,dateV.count,dateV.off); // DateTimeOriginal ASCII
  entry(0x920A,5,1,focalV.off); // FocalLength RATIONAL
  entry(0xA434,2,lensV.count,lensV.off); // LensModel ASCII
  pushU32(bytes,0);
  // append data area
  for(const x of dataArea) bytes.push(x);
  // Wrap: "Exif\0\0" + tiff
  const head = [0x45,0x78,0x69,0x66,0x00,0x00];
  const payload = head.concat(bytes);
  const len = payload.length + 2; // +2 for the length field itself
  const app1 = [0xFF,0xE1, (len>>8)&0xff, len&0xff].concat(payload);
  return app1;
}
module.exports = { buildExifApp1 };

if (require.main === module) {
  const { buildExifApp1 } = module.exports;
  const app1 = buildExifApp1({ make:'FUJIFILM', model:'X-T5', lens:'XF35mmF1.4 R', focal:35, fnum:1.4, exp:1/500, iso:200, date:'2026:03:15 18:42:10' });
  // minimal JPEG: SOI + APP1 + a tiny rest (we can reuse a real jpeg body). For parse test, exifr only needs SOI+APP1.
  const jpeg = Buffer.from([0xFF,0xD8, ...app1, 0xFF,0xD9]);
  require('fs').writeFileSync('/tmp/claude-0/-home-user-Postcard/35a2d768-3d93-5245-8870-f1f0e270a80c/scratchpad/exif-test.jpg', jpeg);
  const exifr = require('/tmp/claude-0/-home-user-Postcard/35a2d768-3d93-5245-8870-f1f0e270a80c/scratchpad/libs/node_modules/exifr');
  exifr.parse(jpeg, { pick:['Make','Model','LensModel','FocalLength','FNumber','ExposureTime','ISO','DateTimeOriginal'] }).then(r => {
    console.log('PARSED:', JSON.stringify(r, null, 1));
  }).catch(e => console.error('PARSE ERR', e));
}
