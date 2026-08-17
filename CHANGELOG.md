# Changelog

All notable changes to Postcard Press.

## [1.2.0] — 2026-08-17

### Added
- **Client-side EXIF metadata parser** (vendored [exifr](https://github.com/MikeKovarik/exifr), self-hosted) — on upload, each photo's `Make`, `Model`, `LensModel`, `FocalLength`, `FNumber`, `ExposureTime` (as `1/500s`), `ISO` and `DateTimeOriginal` are read locally and stored on the card; `meta.camera` and `meta.date` are seeded automatically. EXIF is read from the original file *before* downscaling, and never leaves the device.
- **Smart text tokens** — `{camera}` `{lens}` `{settings}` `{date}` `{title}` `{photographer}` can be used in any front or back text field and resolve live; `{settings}` renders e.g. `35mm · ƒ/1.4 · 1/500s · ISO 200`. Quick-insert chips added to the Text Inspector.
- **Vector-grade dynamic QR codes** (vendored [node-qrcode](https://github.com/soldair/node-qrcode), bundled to a self-contained IIFE) — the back QR element gains a size slider, dark/light colour pickers and position presets (bottom-left/right, top-right stamp area, custom drag). Codes are rasterised on a ≥400px offscreen canvas at error-correction M before compositing, so they never pixelate at 300 DPI, and long URLs that exceeded the old built-in encoder now encode cleanly.

### Notes
- Both libraries are committed under `vendor/` and cached by the service worker — no CDN, still fully offline, zero third-party network requests. The app degrades gracefully if either is absent (EXIF skipped; QR falls back to the built-in encoder).
- Service worker cache bumped to v1.2.0.

## [1.1.0] — 2026-07-18

### Added
- **Custom text elements** on the back — add any number of free text blocks, drag/resize them, and delete them again
- **Colour control** for the selected back element
- **Arrow-key nudging** for the selected back element (Shift for bigger steps)

### Improved
- Front text placement now measures the title/caption stack and uses the bottom border whenever it truly fits (down to 0.2 in), falling back to the photo overlay only when it doesn't — text can no longer spill past the trim
- Photographer credit avoids colliding with the text stack in narrow borders
- `Delete`/`Backspace` matches the editor: hides bound elements, removes custom text

### Fixed
- Service worker cache bumped to v1.1.0 so offline users receive the update

## [1.0.0] — 2026-07-12

Initial release. 🎉

### Added
- Front designer: full bleed, gallery border, editorial, minimal, wide bottom, museum label and custom layouts; border engine with adjustable width/colour and extra bottom border; photo fit/fill with drag positioning, zoom, rotate, reset — aspect ratio always preserved
- Back designer: classic, minimal, editorial, gallery, museum, story card and custom layouts; draggable/resizable caption, story, credit, copyright, project, website, date, location, address lines, stamp placeholder, divider, QR code and logo elements
- Photographer credit system: bottom left / bottom right / centre / back / hidden, with standard and custom formats
- Card sizes: 4×6, 5×7, A6, 105×148 mm, 100×150 mm, 127×178 mm, US Postcard, Square, custom (in/mm/cm), portrait & landscape
- 300 DPI export: JPG (max quality, DPI header), PNG (pHYs), print-ready PDF with bleed and crop marks
- Imposition: multiple cards per A4/Letter sheet, duplex-ready mirrored backs (long/short-edge flip), contact sheets, multi-page PDFs, batch ZIP export
- Duplex preview with alignment guide and printable alignment test page
- Direct browser printing
- Batch workflow: multi-upload, per-card captions/titles/locations/dates, apply-to-all, duplicate, delete, drag-to-reorder
- File naming patterns incl. `{name}-{side}`, `{project}-{index}` and custom token patterns
- Live preview: front / back / side-by-side / print sheet / fullscreen, zoom, pan, fit, actual size, guides
- Liquid Glass light & dark themes
- Local-first persistence: IndexedDB autosave, JSON backup/restore, design presets
- Demo project with three sample postcards
- PWA: installable, fully offline
- Accessibility: keyboard navigation, ARIA labels, focus states, reduced motion, high contrast
- Mobile/touch: swipe to flip, pinch zoom, touch drag, responsive panels, iOS safe areas
