# QR Studio

A browser-based QR code generator that verifies every code by decoding it back out of its own pixels, before you are allowed to trust it. Built for the GDG on Campus SRM Frontend Technical Task.

Everything runs client-side. No account, no backend, no upload.

---

## The problem this was built to solve

The first version of this app looked fine and produced codes that would not scan. Chasing that down turned up four separate defects, all of which are the usual reasons a "QR code generator" hands you a dead code:

**1. Decorative shapes were applied to the finder patterns.**
The renderer drew every dark module through the chosen dot style — circles, diamonds, stars and all. A scanner finds a QR code by looking for three identical concentric-square finder patterns and measuring their 1:1:3:1:1 run-length ratio. Once those squares are drawn as circles or 5-point stars, the ratio is gone and the code is no longer locatable. Now `buildFunctionMask()` marks every function pattern — finders, separators, timing, alignment, dark module — and those are always drawn as exact geometry. The decorative shape applies to data modules only.

**2. Fractional module widths.**
`cellSize = canvasSize / totalModules` produces values like 12.49px. Every module edge lands on a half pixel, the browser antialiases each one, and the binarisation a camera performs on that image lands differently than it does on your screen. The renderer now computes `cell = floor(size / totalModules)` so a module is always a whole number of pixels, and reports the snapped size.

**3. The logo was painted asynchronously.**
The old renderer kicked off `new Image()` and drew the logo in `onload`, then returned. Export right after a style change captured a canvas with no logo — or a logo from the *previous* style arriving late. The logo is now decoded into an `HTMLImageElement` first (`useLogoImage`), and `renderQR` paints it synchronously, so an export taken on the next line is always complete.

**4. The SVG export thresholded a raster.**
`exportAsSVG` sampled the canvas pixels and emitted a `<rect>` wherever `brightness < 128`. That is inverted for any light-on-dark code, ignores gradients entirely, drops the logo, and produces a rasterised approximation of a format that is supposed to be vector. `renderQRToSVG` now builds the SVG from the module matrix with real shapes, a gradient `<defs>` block, and an embedded logo.

Payload encoding had its own bug: `tel:` was built by stripping spaces only, so `+91 98765-43210` became `tel:+9198765-43210`. Many diallers reject stray dashes and brackets, which is what produced "it scans but the number does not come up". Phone numbers are now reduced to E.164.

---

## What it does now

### Verification is real

`ScanBadge` does not estimate a "scannability score". After each render the canvas is box-downsampled to a fixed number of pixels per module — averaging every block, which reproduces the blur a phone camera adds — and handed to [jsQR](https://github.com/cozmo/jsQR) running in a Web Worker. The badge reports PASS only when the decoder reads back the exact string that was encoded.

The distinction matters. A code that only survives as a crisp screenshot fails here, which is the point. When it fails, `diagnose()` names the likely cause from the actual style settings — contrast, sparse module shapes, non-square finders, a quiet zone under 4 modules, logo coverage against the error-correction budget, gradient falloff, or a dense version — and offers a one-click safe style.

`ScanTest` closes the loop on physical output: it points the device camera at a printed code and decodes the live frame, so paper, ink and glare get tested too.

### Action preview

A QR that scans but opens nothing is a payload bug, not a picture bug. The action panel shows exactly what the phone receives — `tel:+919876543210`, `mailto:…`, `SMSTO:…`, `WIFI:T:WPA;S:…` — with a button that opens the dialler or the link so you can confirm the destination before printing. Numbers are normalised to E.164 and shown in readable form, with a warning when there is no country code.

### Numbered sheet generator

Turns one payload into a printable grid of numbered codes for booth desks, table tents, raffle tickets or check-in stations. `{{n}}` inserts the number and `{{label}}` the label in the template. Exports a single PNG sheet or a CSV mapping every code to its payload. Up to 300 codes, with print styles that hide the app and paginate the sheet.

### Everything else

- **Six payload types** — URL, text, email, phone, SMS, Wi-Fi — with real encoding (`https://` prefixing, `mailto:` with encoded subject and body, E.164 `tel:`, `SMSTO:`, escaped `WIFI:` strings).
- **Six module shapes and three finder shapes**, with the fragile ones labelled as such.
- **Solid, linear and radial fills**, plus inverted colour schemes.
- **Logo embedding** with live coverage-percentage reporting against the error-correction budget, and a synchronous paint.
- **Exports** — PNG, true vector SVG, 4K print PNG re-rendered from the matrix rather than upscaled from the preview bitmap, clipboard image, and the raw payload as text.
- **Recent codes** in localStorage, deduplicated by a style fingerprint instead of spamming a new row per keystroke, with migration for entries written by the previous version.
- **Capacity is asked, not estimated.** `checkCapacity()` calls the encoder and reports the real version, so the app can tell you the code is version 31 rather than guessing from a character count.

---

## How the renderer is structured

`src/engines/qr-renderer.ts` is the core, and it follows two rules:

1. **Function patterns are never decorated.** `buildFunctionMask(size, version)` marks the finder blocks plus separators, the timing patterns, the alignment patterns (from `alignmentPositions()`, which derives the ISO/IEC 18004 table algorithmically rather than hardcoding 34 versions) and the mandatory dark module. Everything else is data and gets the chosen shape.

2. **Every module is a whole number of pixels.** The canvas size is exactly `cell * (moduleCount + 2 * margin)`.

Draw order matters: decorative data modules, then timing patterns, then alignment patterns, then the finders on top so they are not overdrawn, then the dark module, then the logo.

Decorative shapes are sized so each module keeps enough dark area to survive binarisation — `circle` at radius 0.5 cells, `diamond` at 0.62 half-diagonal, `star` at 0.68/0.35. Sparse shapes work at high error correction on a large print, and the verifier will say so if yours does not.

---

## Verification approach

The rendering was validated by rasterising the engine output with a real canvas implementation and running the same decoder the app uses over the result, then checking the decoded string equals the encoded one. 86 checks covering:

- 6 module shapes x 3 finder shapes
- 4 error-correction levels x 4 canvas sizes
- 7 quiet-zone widths
- 4 payload types including a 1200-character text payload
- inverted colours, linear gradients, radial gradients, all x 6 module shapes
- version scaling from v5 to v40
- SVG export rasterised and decoded, for every shape, both gradients and all finder shapes
- logo overlay at 12/16/20/24% under error correction H
- a deliberately unsafe case (34% logo under level L) asserted to *fail*, confirming the pass signal is meaningful rather than always-green

Two additional bugs were caught this way that no amount of reading would have found: the finder pattern's concentric rings were all being drawn at the same origin, collapsing it into a plain 1-module outline; and `paintAlignment` was receiving pixel coordinates and multiplying them by the cell size again, which threw the alignment pattern off-canvas entirely.

---

## Tech stack

- **React 19 + TypeScript (strict)** — panels are lifted into `App`, which owns payload, style and verification state.
- **Vite 6** — the verification worker uses `new Worker(new URL(...), { type: 'module' })`; `worker.format: 'es'` is set for it.
- **Canvas API** — `qrcode` produces the module matrix, `qr-renderer.ts` draws it. Custom rendering is what makes module shapes, gradients and compositing possible at all; library components render SVG or `<img>` and cannot.
- **jsQR in a Web Worker** — decoding 500k pixels takes ~100ms, which is unacceptable on the main thread while typing. Falls back to a dynamic import on the main thread if workers are blocked.
- **Vanilla CSS** with custom properties in one file; theming is a `data-theme` attribute swap.

## Project structure

```
src/
├── engines/
│   ├── qr-renderer.ts    -- matrix, function-pattern mask, canvas + SVG output
│   ├── verifier.ts       -- module-aligned downsampling + decoder client
│   ├── verify.worker.ts  -- jsQR off the main thread
│   └── diagnostics.ts    -- decode result + style -> ranked list of causes
├── components/
│   ├── InputPanel.tsx        -- payload tabs and fields
│   ├── CustomizationPanel.tsx-- looks, shapes, colour, EC, logo, size
│   ├── QRPreview.tsx         -- canvas render, verification trigger
│   ├── ScanBadge.tsx         -- PASS/FAIL with causes and fixes
│   ├── ActionPreview.tsx     -- exactly what the scanner receives
│   ├── ScanTest.tsx          -- live camera test of printed output
│   ├── BatchSheet.tsx        -- numbered sheet, print, PNG, CSV
│   ├── DownloadPanel.tsx     -- PNG / SVG / 4K / clipboard / payload
│   └── RecentCodes.tsx       -- localStorage history
├── hooks/useLogoImage.ts -- preloads the logo for synchronous painting
├── utils/
│   ├── validators.ts     -- validation, E.164, encoding, capacity
│   ├── actions.ts        -- payload -> described action + sheet templates
│   ├── storage.ts        -- localStorage with style migration
│   └── exporters.ts      -- download, clipboard, sheet composition
├── types/index.ts
├── App.tsx
└── index.css
```

## Running locally

```
git clone https://github.com/srivris1/qr-code-studio.git
cd qr-code-studio
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build

```
npm run build
```

Static output in `dist/`. Deploy anywhere — Vercel, Netlify, GitHub Pages.

The camera test needs a secure context, so use `localhost` in development and HTTPS in production.