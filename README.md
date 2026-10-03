# QR Studio

A browser-based QR code generator that lets you design, customize, and export QR codes without any server involvement. Built for the GDG on Campus SRM Frontend Technical Task.

## What it does

You pick a data type (URL, plain text, email, phone number, or Wi-Fi credentials), type in the content, and get a live QR code preview that updates as you type. From there you can change colors, pick a dot pattern, add gradients, embed a logo, and download the result as PNG, SVG, or a 4K upscaled version for print.

Everything runs client-side. No data ever leaves the browser.

## Why I built it this way

### Tech stack

- **React 19** with TypeScript — the component model makes it natural to split the UI into discrete panels (input, customization, preview, download) that communicate through lifted state. React 19's improved rendering performance helps since the QR re-renders on every keystroke.

- **Vite 6** — fast HMR during development and tree-shaken production bundles. The final JS bundle is ~90KB gzipped, which is important since this is a single-page tool that should load instantly.

- **HTML5 Canvas API** — I render QR codes directly onto a `<canvas>` element instead of using a pre-built React QR component. This gives full control over dot shapes (circles, diamonds, stars), gradient fills, and logo compositing. The `qrcode` npm package generates the raw module matrix, and my rendering engine (`qr-renderer.ts`) handles the visual output.

- **Vanilla CSS** with custom properties — no Tailwind, no CSS-in-JS. A single `index.css` file defines the entire design system through CSS variables. This keeps the styling predictable and makes theme switching (dark/light) a simple `data-theme` attribute swap.

- **Lucide React** for icons — lightweight, tree-shakeable icon library that fits React's component model.

### Key design decisions

**Custom canvas rendering over library components.** Libraries like `qrcode.react` render to SVG or `<img>` tags, which means you can't customize individual module shapes or apply canvas-level gradients. By using `qrcode.create()` to get the raw boolean matrix and drawing each module manually, I can render circles, stars, diamonds — any shape — and apply linear/radial gradients across the entire code.

**Scannability verification.** It's surprisingly easy to make a QR code that looks great but won't scan. The scan badge computes a score based on WCAG 2.1 contrast ratio (foreground vs background), quiet zone margin, and logo coverage area. If the contrast drops below 4.5:1 (WCAG AA) or the logo covers more modules than the error correction level can recover, the user gets a clear warning.

**LocalStorage for recent codes.** Instead of requiring accounts or a backend, recent QR codes are stored as base64 data URLs in localStorage. Each entry includes the full payload and style configuration, so you can restore any previous code with one click.

### Project structure

```
src/
├── engines/qr-renderer.ts    -- QR matrix generation + canvas drawing
├── components/
│   ├── InputPanel.tsx         -- data type tabs + form fields
│   ├── CustomizationPanel.tsx -- colors, dots, presets, logo, EC level
│   ├── QRPreview.tsx          -- live canvas preview
│   ├── ScanBadge.tsx          -- scannability score
│   ├── DownloadPanel.tsx      -- export buttons
│   └── RecentCodes.tsx        -- localStorage history
├── utils/
│   ├── validators.ts          -- input validation + QR string encoding
│   ├── storage.ts             -- localStorage helpers
│   └── exporters.ts           -- PNG/SVG/clipboard export
├── types/index.ts             -- TypeScript interfaces
├── App.tsx                    -- state management + layout
├── main.tsx                   -- entry point
└── index.css                  -- full design system
```

## Running locally

```
git clone https://github.com/srivris1/qr-code-studio.git
cd qr-code-studio
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Building for production

```
npm run build
```

Static files go to `dist/`. Deploy anywhere — Vercel, Netlify, GitHub Pages, or just serve the folder.

## Features at a glance

- 5 QR data types with proper encoding (URL, text, mailto:, tel:, WIFI: protocol)
- 6 visual presets
- 5 dot patterns (square, circle, rounded, diamond, star)
- Solid color, linear gradient, and radial gradient modes
- Logo embedding with size/padding/border-radius controls
- 4 error correction levels (L/M/Q/H)
- WCAG contrast ratio checking
- Logo coverage vs EC capacity warning
- PNG, SVG, 4K PNG, and clipboard export
- Recent codes with restore and delete
- Dark/light theme
- Fully responsive layout
