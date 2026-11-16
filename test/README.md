# Automated tests

Headless-browser tests that drive the real app (through the UI and the
`window.PostcardPress` hooks). They need Node and Playwright with Chromium.

```bash
npm i playwright && npx playwright install chromium   # skip if already installed
for f in test/*.test.js; do node "$f"; done
```

- `features.wysiwyg.test.js` — v2 redesign: on-card editing, layout gallery, snapping, phone layout, and the 2.0 bug fixes
- `features.exif-qr.test.js` — EXIF parsing, tokens, QR generation, lazy library loading
- `features.print-postmark-tone.test.js` — guides, postmark/stamp, crop & tone, .postcard files
- `features.preset-engine.test.js` — layout registries, diptych, airmail, old-project compatibility
- `regression.test.js` — core pipeline (sample cards, JPG/PDF export, backup)
- `exifbuilder.js` builds a valid EXIF segment so the EXIF path runs without binary fixtures.

Each suite serves the project root on its own localhost port.
