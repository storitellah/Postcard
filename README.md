# Postcard Press by [Storitellah](https://storitellah.com)

**A local-first postcard design studio for photographers, artists, galleries, exhibitions, workshops, NGOs, museums and creative storytellers.**

Design professional, print-ready photo postcards — front and back — entirely in your browser. No login. No sign-up. No cloud uploads. No tracking. Your photographs never leave your device.

![Postcard Press](icons/icon-192.png)

## What it does

**Make the card on the card.** Pick a layout, then click any word on the front or back and type. A small toolbar follows whatever you select: text size, weight, alignment, font and ink for words; zoom, rotate, fill and replace for the photo. Things you drag on the back snap to the centre and to each other.

**15 front layouts**, each previewed with your own photo before you choose: Classic Gallery, Museum Broadsheet, Full-Bleed Modern, Split Diptych, Vintage Polaroid, Fine-Art Mat, Night Gallery, Greetings From (big letters filled with the photo), Travel Poster, 35mm Frame, Postage Stamp, Caption Bar, Editorial, Big Greeting, and Custom.

**11 back layouts**: Classic, Field Note (with camera details), Art Print, Airmail, Promo Mailer, Room to Write, Thank You, Invitation, Specimen Label, Bold Place Name, Plain Mail. Add text, headings, handwritten notes, writing lines, a postmark, a QR code, a stamp box or your logo from the Add panel.

**Print-ready output.** 300 DPI JPG, PNG or PDF with bleed and crop marks; several cards per A4/Letter sheet with backs mirrored for double-sided printing; contact sheets; true-size printing from the browser; a duplex alignment test page. Sizes: 4×6, 5×7, A6, 100×150 mm, 127×178 mm, US postcard, square, or your own.

**Many cards at once.** Drop in a folder of photos and each becomes a card using the current design. Per-card titles, places, dates and messages; apply one front or back to every card; reorder, duplicate, undo.

**Photo details.** Camera, lens and exposure are read from each photo on your device and can be dropped into any text with `{camera}` `{lens}` `{settings}` `{date}` `{title}` `{photographer}`.

**Private by design.** No account, no upload code, no analytics, no third-party requests. Works offline once loaded (installable PWA). Autosaves in your browser; save a `.postcard` file to move a project between devices.

**Works on phones.** On small screens the tools live in a bottom tab bar and open as sheets under the card, so you can see each change as you make it. Swipe to flip, pinch to zoom, tap text twice to type.

## 🚀 Getting started

### Use it
Open `index.html` in any modern browser — that's it. Or serve the folder:

```bash
# any static server works
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Click **See sample cards** to look around, or **Choose photos** to start with your own.

### Install as an app
Postcard Press is a PWA. In Chrome/Edge/Safari, use "Install app" / "Add to Home Screen" and it will work fully offline.

### Deploy it
See [DEPLOYMENT.md](DEPLOYMENT.md) — the project is a plain static site, ready for GitHub Pages, Cloudflare Pages, Netlify, or any web server.

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` | Undo / redo |
| `Ctrl/⌘ + S` | Save a `.postcard` project file |
| `Ctrl/⌘ + P` | Print |
| `F` / `B` | Front / back |
| `←` / `→` | Previous / next postcard |
| `+` / `−` / `0` / `1` | Zoom in / out / fit / actual size |
| `G` | Toggle guides |
| `T` | Toggle theme |
| `↑` `↓` `←` `→` | Nudge selected back element (Shift = bigger steps) |
| `Delete` | Hide / delete selected back element |
| `Enter` | Type into the selected text |
| `Ctrl/⌘ + D` | Duplicate the selected back element |
| `Ctrl/⌘ + E` | Export |
| Hold `Alt` while dragging | Place without snapping |

## 📁 Repository structure

```
index.html            App shell
styles.css            Layout, light/dark themes, print styles
script.js             The entire studio: renderers, export engine, PDF/ZIP/QR writers
manifest.json         PWA manifest
service-worker.js     Offline cache
favicon.svg           Vector icon
icons/                PNG app icons (192/512/maskable/apple-touch/favicon)
fonts/                Instrument Serif + Anton (OFL, self-hosted, latin subset)
vendor/               Two self-hosted MIT libraries (exifr, node-qrcode) — see vendor/README.md
test/                 Headless-browser test suites (see test/README.md)
samples/              Sample exports produced by the automated test suite
README.md             This file
DEPLOYMENT.md         Hosting guide (GitHub Pages, Cloudflare Pages, …)
PRINTING-GUIDE.md     Paper, bleed, duplex and print-shop guidance
TESTING.md            Test plan + automated test report
PRIVACY.md            The short version: everything stays on your device
CHANGELOG.md          Version history
```

No build step and no runtime framework — lightweight vanilla HTML, CSS and JavaScript. The only third-party code is two small **self-hosted** MIT libraries in `vendor/` (EXIF parsing via [exifr](https://github.com/MikeKovarik/exifr) and QR generation via [node-qrcode](https://github.com/soldair/node-qrcode)); they are committed to the repo, loaded only when first needed, cached offline, and never fetched from a CDN, so the app makes zero third-party network requests. Both degrade gracefully if absent.

## 🖨 Printing

Read [PRINTING-GUIDE.md](PRINTING-GUIDE.md) for paper stock recommendations, bleed and safe margin explanations, duplex alignment testing, and instructions for professional print shops.

## 🔒 Privacy

Everything happens locally in your browser. See [PRIVACY.md](PRIVACY.md).

## ❤️ Support the Creator

Postcard Press is made with love by [Storitellah](https://storitellah.com).

- 🧡 **Patreon** — <https://patreon.com/kiberastories>
- ☕ **Ko-fi** — <https://ko-fi.com/kiberastories>
- 🐞 **Bug reports** — <brian@storitellah.com>

## License

© Storitellah. Free to use for creating your postcards. Contact <brian@storitellah.com> about other uses.
