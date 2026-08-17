# Testing

Postcard Press is verified two ways: an automated headless-browser suite run against the real app, and a manual checklist.

## Automated test report — v1.2.0 (EXIF & QR features)

Run: 2026-08-17 · Chromium (Playwright, headless) · viewport 1440×900

EXIF tests import a JPEG with a hand-built, spec-valid EXIF/TIFF APP1 segment through the real upload pipeline; QR tests assert node-qrcode is used and inspect rendered pixels.

| # | Check | Result | Notes |
| --- | --- | --- | --- |
| 1 | Vendored exifr loaded | ✅ PASS | `window.exifr` present |
| 2 | Vendored node-qrcode loaded (sync `create`) | ✅ PASS | |
| 3 | EXIF camera parsed | ✅ PASS | `FUJIFILM X-T5` |
| 4 | EXIF lens parsed | ✅ PASS | `XF35mmF1.4 R` |
| 5 | EXIF settings composed | ✅ PASS | `35mm · ƒ/1.4 · 1/500s · ISO 200` |
| 6 | EXIF date formatted | ✅ PASS | `15 Mar 2026` |
| 7 | `meta.camera` seeded from EXIF | ✅ PASS | |
| 8 | `{camera}`/`{settings}` token replacement | ✅ PASS | |
| 9 | `{title}`/`{photographer}`/`{lens}` replacement | ✅ PASS | |
| 10 | QR uses node-qrcode matrix (long URL encodes) | ✅ PASS | version 41, 89-char URL |
| 11 | QR renders dark modules on back | ✅ PASS | |
| 12 | QR dark colour customisable | ✅ PASS | tinted pixels detected |
| 13 | Token chips render (6) and insert via UI click | ✅ PASS | |
| 14 | Tokens safe when a card has no EXIF | ✅ PASS | returns empty, no crash |

**Feature suite: 14/14 passed, no console errors.**

### Regression (core pipeline, re-run after the changes)

| Check | Result |
| --- | --- |
| Demo project loads 3 postcards | ✅ PASS |
| JPG 300 DPI export (2007 px, DPI header) | ✅ PASS |
| Print-ready PDF valid, 6 pages | ✅ PASS |
| JSON backup/restore round-trip (incl. new `exif` field) | ✅ PASS |
| Dark theme toggle | ✅ PASS |
| QR toggle shows controls + adds element | ✅ PASS |
| No console errors | ✅ PASS |

**Regression: 8/8 passed.**

## Automated test report — v1.1.0

Run: 2026-07-18 · Chromium (Playwright, headless) · viewports 1440×900 and 390×844

| # | Check | Result | Notes |
| --- | --- | --- | --- |
| 1 | App loads | ✅ PASS | title present, shell rendered |
| 2 | Demo project loads 3 postcards | ✅ PASS | |
| 3 | Image store / aspect ratios intact | ✅ PASS | 3:2 source stays 1.500 |
| 4 | Back view renders | ✅ PASS | |
| 5 | JPG export carries 300 DPI JFIF header | ✅ PASS | 2007×1407 px, ~409 KB |
| 6 | JPG export dimensions match 300 DPI + bleed + marks | ✅ PASS | |
| 7 | Back JPG export | ✅ PASS | |
| 8 | PNG export carries 300 DPI pHYs chunk | ✅ PASS | |
| 9 | PDF structure valid (`%PDF-` … `%%EOF`) | ✅ PASS | ~1.5 MB, embedded 300 DPI JPEG |
| 10 | Multi-page PDF (3 cards × front+back = 6 pages) | ✅ PASS | |
| 11 | Duplex A4 imposed sheet PDF | ✅ PASS | mirrored backs |
| 12 | Letter imposed sheet PDF | ✅ PASS | |
| 13 | Contact sheet PDF | ✅ PASS | |
| 14 | QR encoder emits valid matrix (finders, v2) | ✅ PASS | |
| 15 | Batch ZIP archive valid signature | ✅ PASS | |
| 16 | JSON backup → restore round-trip | ✅ PASS | cards, design and images survive |
| 17 | Front layout preset applies | ✅ PASS | |
| 18 | Undo restores previous layout | ✅ PASS | |
| 19 | Redo re-applies | ✅ PASS | |
| 20 | Side-by-side & print-sheet preview modes | ✅ PASS | |
| 21 | Duplicate & delete postcards | ✅ PASS | |
| 22 | Dark theme toggles | ✅ PASS | |
| 23 | Duplex preview renders front + mirrored back sheets | ✅ PASS | |
| 24 | Mobile layout (inspector becomes bottom sheet) | ✅ PASS | 390×844 |
| 25 | Custom text element added & selected (v1.1) | ✅ PASS | editor opens, delete label |
| 26 | Element colour control (v1.1) | ✅ PASS | |
| 27 | Arrow-key nudge of selected element (v1.1) | ✅ PASS | x 0.300 → 0.304 |
| 28 | Custom text element deleted (v1.1) | ✅ PASS | |
| 29 | **No console errors across the whole run** | ✅ PASS | |

**29 / 29 passed.** The suite drives the real UI (clicks, tabs, theme toggle) and calls the export engine directly through `window.PostcardPress` test hooks; the sample files in [`samples/`](samples/) are the untouched output of this run.

## Sample exports (produced by the suite)

| File | What it shows |
| --- | --- |
| `samples/sample-front.jpg` | 300 DPI front, bleed + crop marks, gallery layout, credit bottom-right |
| `samples/sample-back.jpg` | 300 DPI classic back: caption, story, credit, ©, divider, stamp, address, location |
| `samples/sample-postcards.pdf` | Multi-page print-ready PDF, one card per page, vector crop marks |
| `samples/sample-duplex-a4.pdf` | A4 imposition, alternating front/back pages, backs mirrored for long-edge duplex |
| `samples/sample-contact-sheet.pdf` | A4 contact sheet with numbered thumbnails |

## Manual checklist

Functional
- [x] Single photo upload (creates a postcard, preserves aspect ratio)
- [x] Batch upload (each photo becomes a card inheriting the current design)
- [x] Front designer: all 7 layout presets, border width/colour/extra-bottom, fill/fit, drag position, zoom, rotate, reset
- [x] Border engine: even border on all four sides, outside the photo, never crops or distorts
- [x] Caption/title editors (front, back and Card tab stay in sync)
- [x] Credit placement: bottom left / bottom right / centre / back / hidden; all formats incl. custom
- [x] Back designer: all 7 presets; drag, resize, edit, hide every element; QR toggle
- [x] JPG / PNG / PDF export — front only, back only, both; current card and all cards
- [x] Batch export → ZIP; naming patterns incl. custom tokens
- [x] Duplex preview: long/short edge, A4/Letter, alignment guide, test print page
- [x] A4 and Letter sheet layouts with crop marks
- [x] Print preview via browser print dialog
- [x] Backup (JSON download) and restore; autosave restore on reload
- [x] Undo / redo across design edits
- [x] Design presets save / apply / delete

Interface
- [x] Desktop (3-panel workspace), tablet (narrower panels), mobile (drawer + bottom-sheet)
- [x] Light and dark Liquid Glass themes, incl. system preference default
- [x] Swipe front/back, pinch zoom, touch drag on mobile
- [x] Keyboard shortcuts and focus states; reduced-motion and high-contrast media queries

Quality
- [x] No console errors
- [x] No distorted images in any fit/fill/rotate combination
- [x] No cropped text at print size (safe-margin guide + wrapped text rendering)

## Running the suite yourself

The suite is intentionally not vendored into the app (it needs Node + Playwright):

```bash
npm i playwright-core           # plus a Chromium binary
node test.js                    # serves the folder on :8899 and drives the app
```

The app exposes its engine at `window.PostcardPress` (render, export, PDF/ZIP builders, project I/O), so any test runner can drive it without private APIs.
