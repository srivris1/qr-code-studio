# QR Studio

A QR code generator that will not hand you a code it hasn't read back.

Live at [frontend-qr-studio.vercel.app](https://frontend-qr-studio.vercel.app). No account, no server, no upload. Everything happens in the tab.

Built for the GDG on Campus SRM frontend task.

## Why this exists

The brief was "make a QR generator". The first version that worked looked fine and produced codes that would not scan. Not intermittently. Every one of them.

Chasing that turned up four separate defects, and they are still the usual reasons a QR generator hands you a dead code:

- **The finder patterns were drawn through the decorative dot style.** A scanner locates a code by measuring the 1:1:3:1:1 run-length ratio across three concentric squares. Draw those as stars and the ratio is gone, so there is nothing to locate. `buildFunctionMask()` now marks every function pattern, meaning finders, separators, timing patterns, alignment patterns and the mandatory dark module, and those are always painted as exact rectangles. The decorative shape only ever touches data modules.
- **Fractional module widths.** `cellSize = size / totalModules` produces things like 12.49px. Every module edge then falls on a half pixel, the browser antialiases it, and the binarisation a camera performs lands somewhere different than it does on your screen. The renderer snaps to `floor(size / totalModules)` whole pixels and reports the size it actually ended up with.
- **The logo was painted asynchronously.** The old renderer kicked off a `new Image()` and drew inside `onload`, then returned. Export right after a style change captured a canvas with no logo, or with the previous logo arriving late. `useLogoImage` decodes the image first and `renderQR` paints it synchronously, so an export taken on the next line is always complete.
- **The SVG export thresholded a raster.** It sampled preview pixels and emitted a `<rect>` wherever `brightness < 128`. That inverts any light-on-dark code, ignores gradients, drops the logo, and ships a rasterised approximation of a format meant to be vector. `renderQRToSVG` now builds from the module matrix with real shapes, a gradient `<defs>` block and an embedded logo.

## The part that actually matters

A "scannability score" is a guess, and a browser can only ever prove its own pixels. So after each render the app reads its own output back through a real decoder:

1. `renderQR` paints to a canvas on a whole-pixel module grid.
2. `sampleModules` box-downsamples that canvas to 14px per module, averaging every source block. The averaging is the point: it reproduces the blur a camera adds, so a code that only survives as a crisp screenshot fails here on purpose.
3. The frame goes to [jsQR](https://github.com/cozmo/jsQR) in a Web Worker. The badge reads PASS only when the decoder returns the exact string that was encoded.

For a typical URL that is a version 3 code, 29×29 modules, rendered at 481px and sampled down to 518×518, or 268k pixels. Decoding that takes about 24ms on this machine, median, with a worst case near 70ms. Survivable, but not something you want on the main thread while somebody is typing.

When the decode fails, `diagnose()` looks at the real style settings and names the likely cause: contrast under 4:1, a sparse module shape, non-square finders, a quiet zone under 4 modules, logo coverage eating more than the error-correction level can replace, gradient falloff across the finder patterns, or a version so dense it needs a big print. There is a one-click safe style next to it.

`ScanTest` goes further and points the device camera at a printed code, so paper, ink and glare get tested as well.

## The bug that actually shipped

The verifier never worked. Not once, not for any payload, in any style.

`sampleModules` built a single-channel greyscale buffer, `width * height` bytes. jsQR indexes four bytes per pixel and throws `Malformed data passed to binarizer` on anything else. The worker's `catch` turned that into a null result, and the UI rendered a null result as "no finder pattern located".

So every code on the page was reported as unscannable, and the message was confidently wrong about the reason. `VerifyResponse` now carries an `error` field, and the badge distinguishes a pipeline failure from a genuinely bad code instead of blaming your QR for a bug in the check.

The phone number bug was quieter. `normalizePhone` always prefixed `+`, so a plain 10-digit number became `tel:+9876543210`, which is a call to country code 98. And the "cannot exceed 15 digits" validation ran *after* the digits had already been sliced to 15, so it could never fire. Both fixed.

Neither bug was findable by reading the code. Nothing had ever executed those paths outside a browser.

## The test that exists because of that

`npm run check` runs `scripts/check-roundtrip.ts`. It drives the real renderer, the real sampler and the real decoder against a software canvas from `scripts/canvas-shim.ts`: a small supersampled 2D context where `fillRect` is exact, `roundRect` and `arc` are flattened to polygons, gradients are evaluated per pixel, and there is no text or shadow support. It averages 9 samples per pixel, which is enough for antialiased edges to land close to a browser's.

23 assertions, including:

- the sampler hands back RGBA of exactly `width * height * 4` bytes with opaque alpha
- all six payload types round-trip
- `decodePixels` returns the exact string, and explains a malformed buffer instead of returning null
- every combination of 6 module shapes × 3 finder shapes × 4 error-correction levels decodes
- inverted, light-on-dark and gradient fills
- sampling pitches from 6px to 14px per module
- a version 10 dense code
- phone rules: `+91 98765 43210` becomes `tel:+919876543210`, `9876543210` stays `tel:9876543210`, `00` becomes `+`, 16 digits get rejected

`npm run build` runs the check first, so a broken verifier fails the build instead of shipping.

## Phone numbers get their own section

Because the behaviour is easy to get wrong in both directions.

A `tel:` URI should carry `+` only when the user typed one. Prefixing unconditionally turns a national number into a call to whatever country code its first digits happen to spell, which is a worse problem than the one you started with. `00` is rewritten to `+`, punctuation is stripped, and anything over 15 digits is rejected rather than silently truncated, because a truncated number is a call to the wrong person.

The action panel shows the exact string the phone will receive. Most "the code scans but nothing happens" reports are payload bugs rather than picture bugs, and seeing `tel:+919876543210` in plain text settles it faster than any amount of guessing.

## The rest of it

Six payload types: URL, text, email, phone, SMS and Wi-Fi. Six module shapes, three finder shapes, solid or gradient fills, inverted colour schemes, and logo embedding with live coverage reporting against the error-correction budget.

A numbered sheet generator turns one payload into up to 300 codes for booth desks, table tents or raffle tickets. `{{n}}` inserts the number and `{{label}}` the caption. Exports one PNG sheet or a CSV mapping every code to its payload, with print styles that drop the app and paginate.

Exports from the single view: PNG, true vector SVG, a 4K print PNG re-rendered from the matrix rather than upscaled from the preview bitmap, clipboard image, and the raw payload as text.

Capacity is asked rather than estimated. `checkCapacity()` calls the encoder and reports the real version, so the app can say "version 31" instead of inferring it from a character count.

Recent codes live in localStorage, deduplicated by a style fingerprint so you don't get a new row per keystroke, with a migration path for entries written by older builds.

## Running it

```
git clone https://github.com/srivris1/qr-code-studio.git
cd qr-code-studio
npm install
npm run dev
```

Opens at `http://localhost:5173`.

```
npm run check     # round-trip verification, no browser required
npm run build     # check, then tsc -b, then vite build into dist/
npm run preview   # serve the build
```

Static output in `dist/`, so it deploys to Vercel, Netlify or GitHub Pages as-is. The camera test needs a secure context, so use `localhost` in development and HTTPS in production.

React 19 and TypeScript in strict mode. `qrcode` produces the module matrix and `src/engines/qr-renderer.ts` draws it, because the library's own renderers emit SVG or an `<img>` and cannot do per-module shapes, gradients or compositing. jsQR decodes in a worker with a main-thread dynamic-import fallback for locked-down CSPs. Styling is one vanilla CSS file with custom properties; the theme is a `data-theme` attribute swap.

## Layout

```
src/
  engines/
    qr-renderer.ts     module matrix, function-pattern mask, canvas and SVG output
    verifier.ts        module-aligned downsampling, decoder client, RGBA guard
    verify.worker.ts   jsQR off the main thread
    diagnostics.ts     decode result plus style settings, ranked list of causes
  components/
    InputPanel.tsx         payload tabs and fields
    CustomizationPanel.tsx shapes, colour, error correction, logo, size
    QRPreview.tsx          canvas render, verification trigger
    ScanBadge.tsx          PASS/FAIL with causes and a fix
    DecodeTape.tsx         scrolling log of encoder and decoder events
    ActionPreview.tsx      exactly what the scanner receives
    ScanTest.tsx           live camera test of printed output
    BatchSheet.tsx         numbered sheet, print, PNG, CSV
    DownloadPanel.tsx      PNG / SVG / 4K / clipboard / raw payload
    RecentCodes.tsx        localStorage history
  hooks/useLogoImage.ts    preloads the logo for synchronous painting
  utils/
    validators.ts      validation, phone normalisation, encoding, capacity
    actions.ts         payload to described action, sheet templates
    storage.ts         localStorage with style migration
    exporters.ts       download, clipboard, sheet composition
  types/index.ts
  App.tsx
  index.css

scripts/
  canvas-shim.ts       software 2D canvas for headless rendering
  check-roundtrip.ts   render, sample, decode, assert
```

## Limits worth knowing

- jsQR is the only decoder here. The badge reports what it observed and does not claim to speak for every scanner on earth, but a code failing this check may still work with a different reader.
- Verification runs on a 200ms debounce after every change, guarded by a run counter so a stale response cannot overwrite a fresh one. On a very dense payload at high error correction it still takes a moment.
- Diamond and star modules can pass verification at error correction H on a large print and still disappoint on a wristwatch-sized sticker. The diagnostics warn about it. They cannot stop you.
- The test harness is not a pixel-exact model of Chrome. It approximates `roundRect` and `arc` as polygons and ignores text and shadows, which is enough to catch renderer regressions and not enough to prove visual identity.
- `vite.config.ts` sets `worker.format: 'es'`, so the decode worker needs a reasonably modern browser. There is a fallback if workers are blocked, but no polyfill for old engines.