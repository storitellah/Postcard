# Changelog

All notable changes to Postcard Press.

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
