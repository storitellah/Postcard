# Vendored libraries

These are **self-hosted** third-party libraries. They are committed directly to
the repo (not fetched from a CDN at runtime) so Postcard Press stays fully
offline-capable and makes zero third-party network requests. Both are cached by
the service worker as part of the app shell.

| File | Library | Version | License | Purpose |
| --- | --- | --- | --- | --- |
| `exifr.lite.umd.js` | [exifr](https://github.com/MikeKovarik/exifr) | 7.1.3 | MIT | Client-side EXIF/TIFF metadata parsing (the `lite` UMD build) |
| `qrcode.bundle.js` | [node-qrcode](https://github.com/soldair/node-qrcode) | 1.5.4 | MIT | QR code matrix generation (all versions, EC levels) |

## Why these are pre-built

- **exifr** ships an official browser UMD build; `lite.umd.js` is copied verbatim.
  It covers TIFF/EXIF/GPS, which includes every tag we read
  (`Make`, `Model`, `LensModel`, `FocalLength`, `FNumber`, `ExposureTime`, `ISO`,
  `DateTimeOriginal`).
- **node-qrcode** is published as CommonJS only, with no prebuilt browser bundle.
  `qrcode.bundle.js` is its browser entry bundled **once** into a self-contained
  IIFE that exposes `window.QRCode`. This keeps the app itself build-free.

## Regenerating the QR bundle

```bash
npm install qrcode@1.5.4 esbuild
echo "import QRCode from 'qrcode'; window.QRCode = QRCode;" > entry-qr.js
npx esbuild entry-qr.js --bundle --format=iife --minify --outfile=qrcode.bundle.js
```

Both libraries expose synchronous APIs the app relies on: `exifr.parse(file)`
(async, returns a plain object) and `QRCode.create(text, { errorCorrectionLevel })`
(synchronous module matrix). The app degrades gracefully if either global is
missing — EXIF is simply skipped, and QR falls back to the built-in encoder.
