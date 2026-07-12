# Printing Guide

How to get gallery-quality prints from Postcard Press — at home or at a print shop.

## The basics

- Everything exports at **300 DPI**, the standard for sharp photographic print.
- A **4×6 in** postcard with bleed exports at **1875 × 1275 px**; sizes scale accordingly.
- JPG exports use maximum quality (no visible compression); PDFs embed the same 300 DPI imagery.

## Bleed, trim and safe margins

```
┌─────────────────────────────┐  ← bleed edge (0.125 in / 3 mm outside trim)
│  ┌───────────────────────┐  │  ← trim line (the finished card edge)
│  │  ┌─────────────────┐  │  │  ← safe margin (0.1875 in / ~5 mm inside trim)
│  │  │  text & credits │  │  │
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

- **Bleed** lets full-bleed photos run past the trim so cutting never leaves white slivers. Keep it on for professional printing; turn it off for exact-size home printing.
- **Crop marks** show the print shop exactly where to cut. Enable them for PDF exports going to a shop.
- **Safe margin** — keep text inside it. Postcard Press draws it as a dashed green guide (toggle with `G`).

## Paper stock

| Use | Stock |
| --- | --- |
| Mailable postcards | 300–350 gsm (110–130 lb cover) coated one side (C1S) |
| Gallery / art cards | 300–400 gsm uncoated cotton or matte fine-art stock |
| Home inkjet | Heavyweight matte photo card, 250 gsm+ |

C1S stock gives a glossy photo front and a writable uncoated back — ideal for real mailing.

## Printing at home

1. **Export → PDF → One postcard per page** (or use **Print…** directly).
2. In the browser print dialog, set **paper size** to your card stock, **margins: none**, **scale: 100%** — never "fit to page", which resizes your design.
3. For duplex (front + back):
   - Open **Duplex preview** and click **Print alignment test page** first.
   - Print duplex, hold the sheet to the light — the circled targets should overlap. If they are offset, your printer's duplex registration is off; adjust in the printer driver or print sides manually.
   - Choose **long-edge flip** (most printers) or **short-edge flip** to match your driver setting. Postcard Press mirrors the back sheet accordingly so fronts and backs line up.

## Printing multiple cards per sheet

**Export → PDF → Imposed on A4/Letter sheets** places as many cards as fit per sheet, with crop marks, and alternates front/back pages ready for duplex printing. Cut along the marks with a guillotine or rotary trimmer.

## Sending to a print shop

1. Export **PDF** with **bleed ✓** and **crop marks ✓**, "One postcard per page".
2. Tell the shop: *300 DPI, 0.125 in (3 mm) bleed, trim to [your size], duplex, colour.*
3. Postcard Press works in sRGB. Ask the shop to print sRGB or convert to their profile — this is standard for photographic postcards.
4. If they ask for "1-up with marks", that is exactly what the default PDF export produces.

## US mailing note

To mail at USPS postcard rate, cards must be between 3.5×5 in and 4.25×6 in and 0.007–0.016 in thick — the **4×6** and **US Postcard** presets qualify. Leave the lower right area of the back clear for postal barcodes (the default layouts do).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| White edges on full-bleed cards | Enable bleed; make sure print scale is 100%, and trim at the crop marks |
| Text too close to the edge | Keep text inside the dashed safe-margin guide |
| Fronts and backs misaligned | Run the duplex alignment test; switch long/short edge flip |
| Colours look dull | Use photo paper and the printer's photo/quality mode; coated stock prints richer |
| Prints look soft | Check you exported (300 DPI), not a screenshot of the preview |
