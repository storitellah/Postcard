# Automated tests

Headless-browser tests that drive the real app via the `window.PostcardPress`
hooks. They require Node, `playwright-core`, and a Chromium binary.

```bash
npm install playwright-core
# point EXECUTABLE at your Chromium, then:
node test/features.exif-qr.test.js              # EXIF parsing, tokens, QR generation
node test/features.print-postmark-tone.test.js # guides, postmark/stamp, crop & tone, .postcard
node test/features.preset-engine.test.js        # front/back preset registries, diptych, airmail, compat
node test/regression.test.js                    # core pipeline (demo, JPG/PDF export, backup)
```

- `exifbuilder.js` constructs a spec-valid EXIF/TIFF APP1 segment so the EXIF
  path can be exercised without binary fixtures.
- The tests serve the project root on `http://localhost:8899`.

Chromium path is hard-coded to the CI image in these files; change
`executablePath` for your environment.
