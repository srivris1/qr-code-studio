import QRCodeLib from 'qrcode';
import type { QRStyle, DotStyle } from '../types';

interface QRMatrix {
  modules: boolean[][];
  size: number;
}

export function generateMatrix(text: string, errorCorrection: string): QRMatrix {
  const qr = QRCodeLib.create(text, {
    errorCorrectionLevel: errorCorrection as 'L' | 'M' | 'Q' | 'H',
  });
  const size = qr.modules.size;
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(qr.modules.get(r, c) === 1);
    }
    modules.push(row);
  }
  return { modules, size };
}

function isFinderModule(row: number, col: number, moduleCount: number): boolean {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= moduleCount - 7) return true;
  if (row >= moduleCount - 7 && col < 7) return true;
  return false;
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  style: DotStyle
): void {
  switch (style) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'rounded':
      ctx.beginPath();
      ctx.roundRect(
        x + cellSize * 0.05,
        y + cellSize * 0.05,
        cellSize * 0.9,
        cellSize * 0.9,
        cellSize * 0.3
      );
      ctx.fill();
      break;

    case 'diamond': {
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const r = cellSize * 0.45;
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
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const outer = cellSize * 0.48;
      const inner = cellSize * 0.22;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const aOuter = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const aInner = aOuter + Math.PI / 5;
        if (i === 0) {
          ctx.moveTo(cx + Math.cos(aOuter) * outer, cy + Math.sin(aOuter) * outer);
        } else {
          ctx.lineTo(cx + Math.cos(aOuter) * outer, cy + Math.sin(aOuter) * outer);
        }
        ctx.lineTo(cx + Math.cos(aInner) * inner, cy + Math.sin(aInner) * inner);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    default:
      ctx.fillRect(x, y, cellSize, cellSize);
  }
}

function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cellSize: number,
  fgColor: string,
  bgColor: string
): void {
  const s = cellSize;
  ctx.fillStyle = fgColor;
  ctx.beginPath();
  ctx.roundRect(startX, startY, s * 7, s * 7, s * 0.8);
  ctx.fill();

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(startX + s, startY + s, s * 5, s * 5, s * 0.5);
  ctx.fill();

  ctx.fillStyle = fgColor;
  ctx.beginPath();
  ctx.roundRect(startX + s * 2, startY + s * 2, s * 3, s * 3, s * 0.3);
  ctx.fill();
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
  const x1 = center - Math.cos(angle) * length;
  const y1 = center - Math.sin(angle) * length;
  const x2 = center + Math.cos(angle) * length;
  const y2 = center + Math.sin(angle) * length;
  return ctx.createLinearGradient(x1, y1, x2, y2);
}

export function renderQR(
  canvas: HTMLCanvasElement,
  text: string,
  style: QRStyle
): boolean[][] | null {
  if (!text || text.trim().length === 0) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = style.size;
      canvas.height = style.size;
      ctx.fillStyle = style.bgColor;
      ctx.fillRect(0, 0, style.size, style.size);
    }
    return null;
  }

  let matrix: QRMatrix;
  try {
    matrix = generateMatrix(text, style.errorCorrection);
  } catch {
    return null;
  }

  const { modules, size: moduleCount } = matrix;
  const totalModules = moduleCount + style.margin * 2;
  const canvasSize = style.size;
  const cellSize = canvasSize / totalModules;

  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = style.bgColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  let fillStyle: string | CanvasGradient = style.fgColor;
  if (style.gradientType !== 'none') {
    const gradient = createGradient(ctx, canvasSize, style);
    gradient.addColorStop(0, style.gradientColor1);
    gradient.addColorStop(1, style.gradientColor2);
    fillStyle = gradient;
  }
  ctx.fillStyle = fillStyle;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules[row][col]) continue;
      if (isFinderModule(row, col, moduleCount)) continue;

      const x = (col + style.margin) * cellSize;
      const y = (row + style.margin) * cellSize;
      drawDot(ctx, x, y, cellSize, style.dotStyle);
    }
  }

  const finderPositions = [
    [0, 0],
    [0, moduleCount - 7],
    [moduleCount - 7, 0],
  ];
  const fgBase = style.gradientType !== 'none' ? style.gradientColor1 : style.fgColor;
  for (const [fr, fc] of finderPositions) {
    const fx = (fc + style.margin) * cellSize;
    const fy = (fr + style.margin) * cellSize;
    drawFinderPattern(ctx, fx, fy, cellSize, fgBase, style.bgColor);
  }

  if (style.logo) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const logoMaxSize = canvasSize * (style.logoSize / 100);
      const aspect = img.width / img.height;
      let lw = logoMaxSize;
      let lh = logoMaxSize;
      if (aspect > 1) {
        lh = lw / aspect;
      } else {
        lw = lh * aspect;
      }
      const lx = (canvasSize - lw) / 2;
      const ly = (canvasSize - lh) / 2;
      const pad = style.logoPadding;

      ctx.fillStyle = style.bgColor;
      ctx.beginPath();
      ctx.roundRect(lx - pad, ly - pad, lw + pad * 2, lh + pad * 2, style.logoBorderRadius);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, style.logoBorderRadius);
      ctx.clip();
      ctx.drawImage(img, lx, ly, lw, lh);
      ctx.restore();
    };
    img.src = style.logo;
  }

  return modules;
}

export function computeContrastRatio(fg: string, bg: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = hexToRgb(hex);
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
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): number[] {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

export function computeLogoCoverage(
  moduleCount: number,
  logoSizePercent: number,
  logoPadding: number,
  canvasSize: number
): number {
  const totalModules = moduleCount * moduleCount;
  const logoPixelSize = canvasSize * (logoSizePercent / 100) + logoPadding * 2;
  const cellSize = canvasSize / moduleCount;
  const logoCells = Math.ceil(logoPixelSize / cellSize);
  const coveredModules = logoCells * logoCells;
  return (coveredModules / totalModules) * 100;
}
