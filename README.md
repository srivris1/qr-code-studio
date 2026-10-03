# Pro QR Studio

A professional-grade QR code generator and designer built with React 19, TypeScript, and Vite. Generate, customize, and verify stunning QR codes entirely in the browser — no backend required.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![License](https://img.shields.io/badge/License-MIT-green)

## Live Demo

**[→ Open Pro QR Studio](https://pro-qr-studio.vercel.app)**

## Features

### QR Code Generation
- **5 Data Types:** URL, Plain Text, Email (mailto:), Phone (tel:), Wi-Fi (WIFI: protocol)
- **Real-time preview** that updates instantly on every keystroke
- **Smart input validation** with per-field error messages and type-specific formatting

### QR Customization Studio
- **5 Dot Patterns:** Square, Circle, Rounded, Diamond, Star
- **Color Engine:** Solid colors, Linear gradients, Radial gradients with custom angle control
- **Error Correction Levels:** L (~7%), M (~15%), Q (~25%), H (~30%)
- **Configurable size** (256px – 2048px) and quiet zone margin (0–8 modules)
- **Logo Embedding:** Upload PNG/SVG logos with adjustable size, padding, and border radius
- **6 Visual Presets:** Cyberpunk Neon, Midnight Obsidian, Google Cloud, Minimal Emerald, Sunset Horizon, Monochrome Print

### Scan Reliability Verification
- **Scannability Score (0–100%)** computed in real-time based on contrast ratio, margin, and logo coverage
- **WCAG 2.1 Contrast Ratio Audit** with AA compliance check (4.5:1 minimum)
- **Reed-Solomon Safety Gauge** that warns when logo coverage exceeds error correction capacity and recommends upgrading EC level

### Export & Download
- **PNG Download** at native resolution
- **4K Ultra-HD PNG** (4× upscaled for print/merchandise)
- **SVG Vector Download** with custom dot paths for graphic designers
- **Copy to Clipboard** for instant paste into documents/chat

### Local Persistence
- **Recent QR Codes** stored in LocalStorage with thumbnail previews
- **1-click restore** any previous QR code with full style settings
- **Individual delete** or clear all history

### Dark/Light Theme
- System-aware default with manual toggle
- Glassmorphism design with backdrop blur, gradient accents, and micro-animations

### Responsive Design
- Optimized 3-column layout on desktop (≥1200px)
- 2-column on tablet (768–1200px)
- Single-column stacked on mobile (<768px)

## Architecture

```
src/
├── components/
│   ├── InputPanel.tsx          # 5-type input forms with validation
│   ├── CustomizationPanel.tsx  # Colors, gradients, presets, logo, EC
│   ├── QRPreview.tsx           # Live canvas preview with scan scoring
│   ├── ScanBadge.tsx           # Scannability health badge
│   ├── DownloadPanel.tsx       # PNG/SVG/4K/Clipboard export
│   └── RecentCodes.tsx         # LocalStorage history carousel
├── engines/
│   └── qr-renderer.ts         # QR matrix generation, canvas rendering, contrast math
├── utils/
│   ├── validators.ts           # Input validation + QR string builder
│   ├── storage.ts              # LocalStorage API
│   └── exporters.ts            # PNG/SVG/Clipboard export logic
├── types/
│   └── index.ts                # TypeScript interfaces
├── App.tsx                     # Root orchestrator
├── main.tsx                    # Entry point
└── index.css                   # Complete design system (dark/light)
```

## Design Decisions

**Why custom canvas rendering instead of `qrcode.react`?**
The `qrcode` library's `create()` method gives us the raw module matrix. By rendering each module individually on a Canvas, we gain full control over dot shapes (circle, diamond, star), gradient fills, and finder pattern customization — features impossible with a simple `<img>` or pre-rendered component.

**Why WCAG contrast checking?**
Users frequently pick color combinations that look stylish but produce unscannable QR codes. The built-in contrast ratio audit (following WCAG 2.1 AA guidelines at 4.5:1 minimum) provides immediate visual feedback, preventing frustrating scan failures.

**Why Reed-Solomon capacity tracking?**
When users embed logos, they unknowingly cover data modules. The logo coverage gauge calculates the exact percentage of obscured modules and automatically recommends the minimum error correction level needed to maintain scannability.

## Getting Started

```bash
git clone https://github.com/srivris1/qr-code-studio.git
cd qr-code-studio
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build for Production

```bash
npm run build
```

Output is in `dist/` — static files ready for any hosting platform.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Language | TypeScript 5.7 |
| Build | Vite 6 |
| QR Engine | `qrcode` (raw matrix generation) |
| Icons | Lucide React |
| Fonts | Inter, JetBrains Mono (Google Fonts) |
| Styling | Vanilla CSS with CSS Custom Properties |
| Persistence | Browser LocalStorage |
| Deployment | Vercel |

## Edge Cases Handled

- Invalid URL format detection with auto `https://` prepending
- RFC 5322 email validation
- E.164 international phone number formatting
- Wi-Fi SSID/password special character escaping (`\;`, `\,`, `\"`)
- Text content capacity limit check (4,296 characters max)
- Empty/null input graceful handling
- Logo coverage exceeding error correction capacity warning
- Contrast ratio below WCAG AA threshold warning
- Page refresh persistence via LocalStorage
