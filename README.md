# TrueRuler — Online Ruler in Actual Size

Free, no-install online ruler. Original build (not affiliated with anruler.com).

## Features

- **True-size canvas rulers** (horizontal + vertical): cm / mm / inch
- **3 calibration methods**: device database (~40 popular phones, tablets, laptops with factory PPI), screen-diagonal math, bank-card slider (85.60 mm)
- **Auto device detection** from viewport + pixel ratio + user agent
- **Drag-to-measure box** with live cm/mm/inch readout, copy button, arrow-key nudge
- **Cursor-follow readout** on the ruler
- **Protractor mode**: two draggable arms, 0–180° readout
- **Printable paper ruler** (18 cm / 7 in, prints at true 100% scale)
- **Unit converter** (mm, cm, m, inch, ft, yd, pt, px — px uses live PPI)
- **Shareable calibration link** (`#ppi=…`)
- **Screen info panel** (resolution, DPR, PPI, estimated diagonal)
- Dark mode, fullscreen, rotate, zoom warning, PWA offline support

## Files

- `index.html` — the whole app (single file, zero external dependencies)
- `manifest.json`, `sw.js`, `icon-*.svg` — PWA support
- `tools/test.js` — node unit tests for the ruler math (`node tools/test.js`)

## Deploy

Static hosting (GitHub Pages, Netlify, any web server). Serve over HTTPS for the service worker.
