import QRCodeLib from 'qrcode';
import type { QRStyle, DotStyle, FinderShape } from '../types';
import type { RenderInfo } from '../types';

/**
 * QR rendering engine.
 *
 * The single most important rule in here: function patterns (finder, timing,
 * alignment, dark module) are *never* drawn with the decorative dot shape.
 * They are the parts of the symbol a scanner uses to locate and grid the code,
 * so they are always drawn as exact geometry. Decorative shapes are applied to
 * data modules only, sized so each module keeps enough dark area to survive
 * binarisation on a real camera.
 *
 * The second rule: every module occupies a whole number of device pixels.
 * Fractional module widths produce antialiased edges that decode differently on
 * screen, in print, and on a phone camera.
 */

interface QRMatrix {
  modules: boolean[][];
  size: number;
  version: number;
}

export function generateMatrix(text: string, errorCorrection: string): QRMatrix {
  const qr = QRCodeLib.create(text, {
    errorCorrectionLevel: errorCorrection as 'L' | 'M' | 'Q' | 'H',
  });
  const size = qr.modules.size;
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = new Array(size);
    for (let c = 0; c < size; c++) {
      row[c] = qr.modules.get(r, c) === 1;
    }
    modules.push(row);
  }
  return { modules, size, version: qr.version };
}

/** Alignment pattern centre coordinates for a version (ISO/IEC 18004 table E.1). */
export function alignmentPositions(version: number): number[] {
  if (version < 2) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step =
    version === 32
      ? 26
      : Math.floor((version * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

/**
 * Marks every module that belongs to a function pattern. A scanner locates the
 * code from these, so they are rendered with exact geometry regardless of the
 * chosen dot style.
 */
export function buildFunctionMask(size: number, version: number): boolean[][] {
  const mask: boolean[][] = [];
  for (let r = 0; r < size; r++) mask.push(new Array<boolean>(size).fill(false));

  const fill = (r0: number, c0: number, h: number, w: number) => {
    for (let r = r0; r < r0 + h; r++) {
      for (let c = c0; c < c0 + w; c++) {
        if (r >= 0 && r < size && c >= 0 && c < size) mask[r][c] = true;
      }
    }
  };

  // Finder patterns plus their one-module light separator.
  fill(0, 0, 8, 8);
  fill(0, size - 8, 8, 8);
  fill(size - 8, 0, 8, 8);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    mask[6][i] = true;
    mask[i][6] = true;
  }

  // Alignment patterns, skipping the three that collide with a finder.
  const pos = alignmentPositions(version);
  for (const r of pos) {
    for (const c of pos) {
      const overlapsFinder =
        (r === 6 && c === 6) ||
        (r === 6 && c === size - 7) ||
        (r === size - 7 && c === 6);
      if (overlapsFinder) continue;
      fill(r - 2, c - 2, 5, 5);
    }
  }

  // The always-dark module.
  if (size - 8 >= 0) mask[size - 8][8] = true;

  return mask;
}

function finderOrigins(size: number): { row: number; col: number }[] {
  return [
    { row: 0, col: 0 },
    { row: 0, col: size - 7 },
    { row: size - 7, col: 0 },
  ];
}

const FINDER_RADIUS: Record<FinderShape, number> = {
  square: 0,
  rounded: 0.3,
  circle: 0.5,
};

type Paint = string | CanvasGradient;

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: DotStyle,
  x: number,
  y: number,
  cell: number,
  color: Paint
): void {
  ctx.fillStyle = color;
  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'rounded':
      ctx.beginPath();
      ctx.roundRect(x, y, cell, cell, cell * 0.32);
      ctx.fill();
      break;

    case 'connected':
      ctx.beginPath();
      ctx.roundRect(x, y, cell, cell, cell * 0.5);
      ctx.fill();
      break;

    case 'diamond': {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const r = cell * 0.62;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'star': {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const outer = cell * 0.68;
      const inner = cell * 0.35;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const aOuter = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const aInner = aOuter + Math.PI / 5;
        if (i === 0) ctx.moveTo(cx + Math.cos(aOuter) * outer, cy + Math.sin(aOuter) * outer);
        else ctx.lineTo(cx + Math.cos(aOuter) * outer, cy + Math.sin(aOuter) * outer);
        ctx.lineTo(cx + Math.cos(aInner) * inner, cy + Math.sin(aInner) * inner);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    default:
      ctx.fillRect(x, y, cell, cell);
  }
}

function createGradient(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  style: QRStyle
): CanvasGradient {
  if (style.gradientType === 'radial') {
    const center = canvasSize / 2;
    return ctx.createRadialGradient(center, center, 0, center, center, center);
  }
  const angle = (style.gradientAngle * Math.PI) / 180;
  const center = canvasSize / 2;
  const length = canvasSize / 2;
  return ctx.createLinearGradient(
    center - Math.cos(angle) * length,
    center - Math.sin(angle) * length,
    center + Math.cos(angle) * length,
    center + Math.sin(angle) * length
  );
}

function resolveFill(ctx: CanvasRenderingContext2D, pixelSize: number, style: QRStyle): Paint {
  if (style.gradientType === 'none') return style.fgColor;
  const gradient = createGradient(ctx, pixelSize, style);
  gradient.addColorStop(0, style.gradientColor1);
  gradient.addColorStop(1, style.gradientColor2);
  return gradient;
}

function paintFinder(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  cell: number,
  shape: FinderShape,
  fg: Paint,
  bg: Paint
): void {
  const factor = FINDER_RADIUS[shape];
  const rings: { cells: number; paint: Paint }[] = [
    { cells: 7, paint: fg },
    { cells: 5, paint: bg },
    { cells: 3, paint: fg },
  ];
  for (const ring of rings) {
    // Each ring is concentric inside the previous one, so it steps inward by
    // one module per level. Drawing them all at the same origin collapses the
    // finder pattern into a plain outline and the code stops being locatable.
    const inset = (7 - ring.cells) / 2;
    const size = ring.cells * cell;
    const x = originX + inset * cell;
    const y = originY + inset * cell;
    const radius = Math.min(factor * size, size / 2);
    ctx.fillStyle = ring.paint;
    if (radius <= 0) {
      ctx.fillRect(x, y, size, size);
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, radius);
      ctx.fill();
    }
  }
}

function paintAlignment(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  cell: number,
  fg: Paint,
  bg: Paint
): void {
  const x = centerX - 2 * cell;
  const y = centerY - 2 * cell;
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, 5 * cell, 5 * cell);
  ctx.fillStyle = bg;
  ctx.fillRect(x + cell, y + cell, 3 * cell, 3 * cell);
  ctx.fillStyle = fg;
  ctx.fillRect(x + 2 * cell, y + 2 * cell, cell, cell);
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  style: QRStyle,
  cell: number,
  moduleCount: number
): void {
  const codeArea = cell * moduleCount;
  const maxSide = codeArea * (style.logoSize / 100);
  const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
  let lw = maxSide;
  let lh = maxSide;
  if (aspect > 1) lh = lw / aspect;
  else lw = lh * aspect;

  const codeOrigin = (cell * (moduleCount)) / 2;
  const lx = Math.round(codeOrigin - lw / 2);
  const ly = Math.round(codeOrigin - lh / 2);
  const pad = style.logoPadding;

  ctx.fillStyle = style.bgColor;
  ctx.beginPath();
  ctx.roundRect(
    Math.round(lx - pad),
    Math.round(ly - pad),
    Math.round(lw + pad * 2),
    Math.round(lh + pad * 2),
    style.logoBorderRadius
  );
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(lx, ly, Math.round(lw), Math.round(lh), style.logoBorderRadius);
  ctx.clip();
  ctx.drawImage(img, lx, ly, Math.round(lw), Math.round(lh));
  ctx.restore();
}

function clearCanvas(canvas: HTMLCanvasElement, size: number, bg: string): CanvasRenderingContext2D {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  return ctx;
}

/**
 * Renders `text` into `canvas` on a whole-pixel module grid.
 *
 * `logoImage` must already be decoded — the logo is painted synchronously so
 * that any export taken right after this call is guaranteed to contain it.
 */
export function renderQR(
  canvas: HTMLCanvasElement,
  text: string,
  style: QRStyle,
  logoImage: HTMLImageElement | null = null
): RenderInfo | null {
  if (!text || text.trim().length === 0) {
    clearCanvas(canvas, Math.max(64, style.size), style.bgColor);
    return null;
  }

  let matrix: QRMatrix;
  try {
    matrix = generateMatrix(text, style.errorCorrection);
  } catch {
    clearCanvas(canvas, Math.max(64, style.size), style.bgColor);
    return null;
  }

  const { modules, size: moduleCount, version } = matrix;
  const margin = Math.max(0, Math.min(8, Math.round(style.margin)));
  const totalModules = moduleCount + margin * 2;
  const cell = Math.max(1, Math.floor(style.size / totalModules));
  const pixelSize = cell * totalModules;

  const ctx = clearCanvas(canvas, pixelSize, style.bgColor);
  const fg = resolveFill(ctx, pixelSize, style);
  const origin = margin * cell;
  const functionMask = buildFunctionMask(moduleCount, version);

  // 1. Decorative data modules.
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (!modules[r][c] || functionMask[r][c]) continue;
      drawShape(ctx, style.dotStyle, origin + c * cell, origin + r * cell, cell, fg);
    }
  }

  // 2. Timing patterns as exact squares.
  ctx.fillStyle = fg;
  for (let i = 8; i < moduleCount - 8; i++) {
    if (modules[6][i]) ctx.fillRect(origin + i * cell, origin + 6 * cell, cell, cell);
    if (modules[i][6]) ctx.fillRect(origin + 6 * cell, origin + i * cell, cell, cell);
  }

  // 3. Alignment patterns.
  const positions = alignmentPositions(version);
  for (const r of positions) {
    for (const c of positions) {
      const overlapsFinder =
        (r === 6 && c === 6) ||
        (r === 6 && c === moduleCount - 7) ||
        (r === moduleCount - 7 && c === 6);
      if (overlapsFinder) continue;
      paintAlignment(ctx, origin + r * cell, origin + c * cell, cell, fg, style.bgColor);
    }
  }

  // 4. Finder patterns, drawn last so they sit on top of the data field.
  for (const { row, col } of finderOrigins(moduleCount)) {
    paintFinder(ctx, origin + col * cell, origin + row * cell, cell, style.finderShape, fg, style.bgColor);
  }

  // 5. The mandatory dark module.
  ctx.fillStyle = fg;
  ctx.fillRect(origin + 8 * cell, origin + (moduleCount - 8) * cell, cell, cell);

  // 6. Logo, synchronously.
  if (logoImage && style.logoSize > 0) {
    drawLogo(ctx, logoImage, style, cell, moduleCount);
  }

  return { modules, moduleCount, version, cell, margin, totalModules, pixelSize };
}

function svgShape(shape: DotStyle, x: number, y: number, cell: number): string {
  const n = (v: number) => (Math.round(v * 100) / 100).toString();
  switch (shape) {
    case 'circle':
      return `<circle cx="${n(x + cell / 2)}" cy="${n(y + cell / 2)}" r="${n(cell * 0.5)}"/>`;
    case 'rounded':
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(cell)}" height="${n(cell)}" rx="${n(cell * 0.32)}"/>`;
    case 'connected':
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(cell)}" height="${n(cell)}" rx="${n(cell * 0.5)}"/>`;
    case 'diamond':
      return `<polygon points="${n(x + cell / 2)},${n(y)} ${n(x + cell)},${n(y + cell / 2)} ${n(x + cell / 2)},${n(y + cell)} ${n(x)},${n(y + cell / 2)}"/>`;
    case 'star': {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const outer = cell * 0.68;
      const inner = cell * 0.35;
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const aOuter = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const aInner = aOuter + Math.PI / 5;
        pts.push(`${n(cx + Math.cos(aOuter) * outer)},${n(cy + Math.sin(aOuter) * outer)}`);
        pts.push(`${n(cx + Math.cos(aInner) * inner)},${n(cy + Math.sin(aInner) * inner)}`);
      }
      return `<polygon points="${pts.join(' ')}"/>`;
    }
    default:
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(cell)}" height="${n(cell)}"/>`;
  }
}

function svgFinder(x: number, y: number, cell: number, shape: FinderShape, fg: string, bg: string): string {
  const factor = FINDER_RADIUS[shape];
  const n = (v: number) => (Math.round(v * 100) / 100).toString();
  const rings: { cells: number; paint: string }[] = [
    { cells: 7, paint: fg },
    { cells: 5, paint: bg },
    { cells: 3, paint: fg },
  ];
  return rings
    .map(({ cells, paint }) => {
      const inset = (7 - cells) / 2;
      const size = cells * cell;
      const rx = x + inset * cell;
      const ry = y + inset * cell;
      const radius = Math.min(factor * size, size / 2);
      if (radius <= 0) {
        return `<rect x="${n(rx)}" y="${n(ry)}" width="${n(size)}" height="${n(size)}" fill="${paint}"/>`;
      }
      return `<rect x="${n(rx)}" y="${n(ry)}" width="${n(size)}" height="${n(size)}" rx="${n(radius)}" fill="${paint}"/>`;
    })
    .join('');
}

/**
 * True vector export. Built from the module matrix, not from raster sampling, so
 * gradients, light-on-dark colours and the logo all survive.
 */
export function renderQRToSVG(
  text: string,
  style: QRStyle,
  logoDataUrl: string | null = null
): { svg: string; pixelSize: number } | null {
  if (!text || text.trim().length === 0) return null;

  let matrix: QRMatrix;
  try {
    matrix = generateMatrix(text, style.errorCorrection);
  } catch {
    return null;
  }

  const { modules, size: moduleCount, version } = matrix;
  const margin = Math.max(0, Math.min(8, Math.round(style.margin)));
  const totalModules = moduleCount + margin * 2;
  const cell = Math.max(1, Math.floor(style.size / totalModules));
  const pixelSize = cell * totalModules;
  const origin = margin * cell;
  const n = (v: number) => (Math.round(v * 100) / 100).toString();

  const useGradient = style.gradientType !== 'none';
  const fgAttr = useGradient ? 'url(#qrGradient)' : style.fgColor;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${pixelSize} ${pixelSize}" width="${pixelSize}" height="${pixelSize}">`
  );

  if (useGradient) {
    const grad =
      style.gradientType === 'radial'
        ? `<radialGradient id="qrGradient" cx="50%" cy="50%" r="50%">`
        : `<linearGradient id="qrGradient" x1="0%" y1="0%" x2="100%" y2="100%">`;
    const close = style.gradientType === 'radial' ? '</radialGradient>' : '</linearGradient>';
    parts.push(
      `<defs>${grad}<stop offset="0%" stop-color="${style.gradientColor1}"/><stop offset="100%" stop-color="${style.gradientColor2}"/>${close}</defs>`
    );
  }

  parts.push(`<rect width="${pixelSize}" height="${pixelSize}" fill="${style.bgColor}"/>`);
  parts.push(`<g fill="${fgAttr}">`);

  const functionMask = buildFunctionMask(moduleCount, version);

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (!modules[r][c] || functionMask[r][c]) continue;
      parts.push(svgShape(style.dotStyle, origin + c * cell, origin + r * cell, cell));
    }
  }

  for (let i = 8; i < moduleCount - 8; i++) {
    if (modules[6][i]) {
      parts.push(`<rect x="${n(origin + i * cell)}" y="${n(origin + 6 * cell)}" width="${n(cell)}" height="${n(cell)}"/>`);
    }
    if (modules[i][6]) {
      parts.push(`<rect x="${n(origin + 6 * cell)}" y="${n(origin + i * cell)}" width="${n(cell)}" height="${n(cell)}"/>`);
    }
  }

  parts.push('</g>');

  const positions = alignmentPositions(version);
  for (const r of positions) {
    for (const c of positions) {
      const overlapsFinder =
        (r === 6 && c === 6) ||
        (r === 6 && c === moduleCount - 7) ||
        (r === moduleCount - 7 && c === 6);
      if (overlapsFinder) continue;
      const x = origin + (c - 2) * cell;
      const y = origin + (r - 2) * cell;
      parts.push(
        `<g><rect x="${n(x)}" y="${n(y)}" width="${n(5 * cell)}" height="${n(5 * cell)}" fill="${fgAttr}"/>` +
          `<rect x="${n(x + cell)}" y="${n(y + cell)}" width="${n(3 * cell)}" height="${n(3 * cell)}" fill="${style.bgColor}"/>` +
          `<rect x="${n(x + 2 * cell)}" y="${n(y + 2 * cell)}" width="${n(cell)}" height="${n(cell)}" fill="${fgAttr}"/></g>`
      );
    }
  }

  for (const { row, col } of finderOrigins(moduleCount)) {
    parts.push(svgFinder(origin + col * cell, origin + row * cell, cell, style.finderShape, fgAttr, style.bgColor));
  }

  parts.push(
    `<rect x="${n(origin + 8 * cell)}" y="${n(origin + (moduleCount - 8) * cell)}" width="${n(cell)}" height="${n(cell)}" fill="${fgAttr}"/>`
  );

  if (logoDataUrl) {
    const codeArea = cell * moduleCount;
    const maxSide = codeArea * (style.logoSize / 100);
    const pad = style.logoPadding;
    const plate = maxSide + pad * 2;
    const lx = origin + (codeArea - maxSide) / 2;
    const ly = origin + (codeArea - maxSide) / 2;
    parts.push(
      `<rect x="${n(lx - pad)}" y="${n(ly - pad)}" width="${n(plate)}" height="${n(plate)}" rx="${n(style.logoBorderRadius)}" fill="${style.bgColor}"/>`
    );
    parts.push(
      `<image href="${logoDataUrl}" xlink:href="${logoDataUrl}" x="${n(lx)}" y="${n(ly)}" width="${n(maxSide)}" height="${n(maxSide)}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }

  parts.push('</svg>');
  return { svg: parts.join(''), pixelSize };
}

export function computeContrastRatio(fg: string, bg: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  if (lighter === 0 && darker === 0) return 21;
  return (lighter + 0.05) / (darker + 0.05);
}

export function hexToRgb(hex: string): number[] | null {
  if (typeof hex !== 'string') return null;
  let value = hex.trim().replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.substring(0, 2), 16),
    parseInt(value.substring(2, 4), 16),
    parseInt(value.substring(4, 6), 16),
  ];
}

/** Fraction of the code area hidden by the logo plate, in percent. */
export function computeLogoCoverage(
  moduleCount: number,
  logoSizePercent: number,
  logoPadding: number,
  cell: number
): number {
  if (moduleCount <= 0 || cell <= 0) return 0;
  const codeArea = cell * moduleCount;
  const plate = codeArea * (logoSizePercent / 100) + logoPadding * 2;
  return (plate * plate) / (codeArea * codeArea) * 100;
}
