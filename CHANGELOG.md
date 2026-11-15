# Changelog

All notable changes to Postcard Press.

## [2.0.0] — 2026-11-15

### Redesign
- New look: paper, ink and one postal red instead of the frosted-glass panels. No blur effects (they were slow on phones), no emoji, plainer wording throughout.
- Workspace is now layouts / photos / add / setup on the left, the card in the middle, and a Front / Back editing panel on the right. Export moved to its own dialog that says exactly what you'll get.
- Phones and tablets get a bottom tab bar. Each tool opens as a sheet under the card so you can still see what you're changing; the zoom bar and filmstrip step aside while a sheet is open.
- Two self-hosted typefaces (Instrument Serif and Anton, OFL) so cards look the same on every device.

### Edit on the card (WYSIWYG)
- Click any text on the front or back to select it; double-click (or tap twice) to type straight onto the card.
- A floating toolbar follows the selection: size, bold, italic, alignment, font, ink colour, duplicate and hide for text; zoom, rotate, fill/whole and replace for the photo.
- Dragging things on the back snaps to the centre, the safe area and the edges of other elements (hold Alt to place freely).
- The layout gallery previews every layout with your own photo and words.
- Drop a photo onto the card to swap its picture; "Replace…" does the same from the panel.
- Enter edits the selected text, Ctrl+D duplicates, Ctrl+E opens Export. Removing a card or replacing a photo offers Undo in the notification.

### New layouts
- Front (8 new, 15 total): Night Gallery, Greetings From (big letters filled with the photo), Travel Poster, 35mm Frame, Postage Stamp, Caption Bar, Editorial, Big Greeting. Layouts with a colour band get their own colour choices.
- Back (6 new, 11 total): Room to Write, Thank You, Invitation, Specimen Label, Bold Place Name, Plain Mail.
- New back pieces: writing lines, handwritten note, heading, logo, divider.

### Fixed
- The diptych's "second photo" button never appeared (it checked for the wrong layout id).
- Swipe-to-flip on phones never fired (panning reset the flag it checked).
- Undo after removing a card, the logo or a diptych photo brought the card back without its picture.
- Dragging a photo could pull it off the edge and show the paper underneath.
- Empty name, website, project and copyright fields printed as "Your Name", "Your Website"… on exported files. Hints now appear on screen only.
- An empty QR code printed as a dashed "QR" box; an empty postmark town printed as "YOUR LOCATION".
- Full-Bleed Modern ignored its corner-type setting.
- Contact sheets were blurry (cards rendered at 72 ppi then scaled up) and dropped cards that didn't fit a fixed 9-per-page grid.
- Printing stretched each card to fill the paper; pages now print at true size, with sheets set to A4 or Letter.
- The Airmail border's red/blue stripes were missing on the right and bottom edges.
- "Show logo on the back" was suggested but impossible; there's now Add → Logo.
- Typing a portrait custom size flipped back to landscape.
- Removed `maximum-scale=1, user-scalable=no`, which blocked pinch-zoom for people who need it.

### Faster
- Scripts load with `defer`; the EXIF reader and QR encoder are fetched only when first needed.
- Autosave writes each photo once and then only the small design state, instead of re-saving every photo on every change.
- The preview reuses its canvases and caches QR codes instead of rebuilding them every frame.
- The service worker fetches the page network-first, so a new release shows up on the next visit.
- Measured on an emulated mid-range phone (4× CPU slowdown, 1.6 Mbps): first paint 492 ms vs 576 ms before.

## [1.4.0] — 2026-08-18

### Added — Expanded preset & template engine
- **Declarative preset registries** (`FRONT_PRESETS`, `BACK_PRESETS`) following a `CardPreset` schema (`id`, `name`, `category`, `thumbnailSvg`, `defaults`). Presets are pure configuration; the picker is now a **thumbnail gallery** with lightweight inline-SVG previews.
- **Six front archetypes:** Classic Gallery (delicate white border + blind-deboss hairline + centred serif caption), Museum Broadsheet (framed photo over a typographic plaque with headline, subtitle, shot details and series index), Full-Bleed Modern (edge-to-edge with scrim-protected corner type), **Split Diptych** (two comparative photos with a divider and unified credit — adds a per-card second photo), Vintage Polaroid (thick instant-white bottom border with a script-font note), and Fine-Art Mat (warm-ivory floating mat with a hairline deboss).
- **Five back archetypes:** Classic Universal (50/50 rule, stamp box, address grid), Field Note / Dispatch (editorial prose column + EXIF data table, coordinates box and QR), Minimalist Art Print (no address lines; centred exhibition stamp, bio, edition box, copyright), Vintage Airmail (red/blue chevron border, circular postmark, typewriter mono), and Direct Mailer / Promo (CTA headline, paragraph, QR banner, contact grid, barcode clearance box).
- New back element types: `airmail` chevron border, `box` (labelled/edition/coords/barcode), plus `exiftable`, `coords`, `bio`, `contact`, `cta`, `edition` text bindings. New `script` font for handwritten captions.

### Compatibility
- Older projects load unchanged: legacy front `layout` ids and back layouts are mapped to the nearest new preset, and missing fields are backfilled on import.
- Service worker cache bumped to v1.4.0.

## [1.3.0] — 2026-08-18

### Added
- **Print-safety guide overlay** — the preview now shows a shaded diagonal-hatch **bleed** band, a solid highlighted **trim** line, and a dashed **safe-zone** inner margin. Guides render in the interactive preview only and are never included in JPG/PNG/PDF exports.
- **Vintage postmark generator** — a draggable vector postmark element with city/location text on a top arc, a date line on the bottom arc, a centre star, and configurable wavy cancellation lines. Ink presets (slate / black / faded red), adjustable density, and a vintage **multiply** ink-blend toggle.
- **Custom stamp** — the stamp box can be a placeholder outline, a **vintage perforated frame**, or a **custom uploaded image** (cropped to a perforated stamp shape).
- **Aspect-ratio crop snapping** on the front photo — Native, 3:2, 4:3, 1:1, 16:9 and 65:24 (XPan panoramic). The window is letterboxed inside the frame; the photo itself is never distorted.
- **Non-destructive tonal adjustments** — B&W Classic, B&W High-contrast, Warm and Cool white-balance looks, plus Exposure and Contrast sliders, applied live at render time (and at 300 DPI export) via canvas filters.
- **`.postcard` project archive** — "Export project" now writes a single `.postcard` file bundling photos (base64), layouts, typography and settings; "Import project" and **drag-and-drop** of a `.postcard` file restore the whole workspace.

### Notes
- All new photo/stamp data persists in the `.postcard`/autosave archive and survives backup/restore.
- Service worker cache bumped to v1.3.0.

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
