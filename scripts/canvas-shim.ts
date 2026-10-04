/**
 * A small software canvas, just enough to run `renderQR` outside a browser.
 *
 * The point of this file is regression coverage: the verifier reads pixels back
 * out of a canvas, and the only way that path got shipped broken is that nobody
 * ever executed it outside a real browser. `scripts/check-roundtrip.ts` renders
 * through this shim and decodes the result with the same jsQR the app uses.
 *
 * Drawing is supersampled 3x and box-filtered on read, so antialiased edges come
 * out close to what a browser produces.
 */

const SS = 3;

type Point = [number, number];

interface GradientStop {
  offset: number;
  color: [number, number, number];
}

function parseColor(value: string): [number, number, number] {
  let hex = String(value).trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return [0, 0, 0];
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

class Gradient {
  readonly kind: 'linear' | 'radial';
  readonly coords: number[];
  private readonly stops: GradientStop[] = [];

  constructor(kind: 'linear' | 'radial', coords: number[]) {
    this.kind = kind;
    this.coords = coords;
  }

  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color: parseColor(color) });
    this.stops.sort((a, b) => a.offset - b.offset);
  }

  /** Colour at a point in logical (unscaled) canvas space. */
  at(x: number, y: number): [number, number, number] {
    if (this.stops.length === 0) return [0, 0, 0];
    if (this.stops.length === 1) return this.stops[0].color;

    let t: number;
    if (this.kind === 'linear') {
      const [x0, y0, x1, y1] = this.coords;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const lengthSq = dx * dx + dy * dy || 1;
      t = ((x - x0) * dx + (y - y0) * dy) / lengthSq;
    } else {
      const [cx, cy, r0, , r1] = this.coords;
      const outer = r1 - r0 || 1;
      const dist = Math.hypot(x - cx, y - cy) - r0;
      t = dist / outer;
    }
    t = Math.min(1, Math.max(0, t));

    let lower = this.stops[0];
    let upper = this.stops[this.stops.length - 1];
    for (let i = 0; i < this.stops.length - 1; i++) {
      if (t >= this.stops[i].offset && t <= this.stops[i + 1].offset) {
        lower = this.stops[i];
        upper = this.stops[i + 1];
        break;
      }
    }
    const span = upper.offset - lower.offset;
    const k = span > 0 ? (t - lower.offset) / span : 0;
    return [
      Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * k),
      Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * k),
      Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * k),
    ];
  }
}

type Paint = string | Gradient;

interface SubPath {
  points: Point[];
  closed: boolean;
}

export class ShimContext {
  fillStyle: Paint = '#000000';
  private buffer: Uint8ClampedArray;
  private bw: number;
  private bh: number;
  private subpaths: SubPath[] = [];
  private current: SubPath | null = null;
  private clipRect: { x0: number; y0: number; x1: number; y1: number };
  private clipStack: { x0: number; y0: number; x1: number; y1: number }[] = [];

  constructor(readonly logicalWidth: number, readonly logicalHeight: number) {
    this.bw = logicalWidth * SS;
    this.bh = logicalHeight * SS;
    this.buffer = new Uint8ClampedArray(this.bw * this.bh * 4);
    this.clipRect = { x0: 0, y0: 0, x1: this.bw, y1: this.bh };
  }

  clear(): void {
    this.buffer.fill(0);
  }

  save(): void {
    this.clipStack.push({ ...this.clipRect });
  }

  restore(): void {
    const restored = this.clipStack.pop();
    if (restored) this.clipRect = restored;
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient {
    return new Gradient('linear', [x0, y0, x1, y1]);
  }

  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ): Gradient {
    return new Gradient('radial', [x0, y0, r0, x1, y1, r1]);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.paintRect(x * SS, y * SS, w * SS, h * SS);
  }

  beginPath(): void {
    this.subpaths = [];
    this.current = null;
  }

  moveTo(x: number, y: number): void {
    this.current = { points: [[x * SS, y * SS]], closed: false };
    this.subpaths.push(this.current);
  }

  lineTo(x: number, y: number): void {
    if (!this.current) this.moveTo(x, y);
    else this.current.points.push([x * SS, y * SS]);
  }

  closePath(): void {
    if (this.current) this.current.closed = true;
  }

  arc(cx: number, cy: number, radius: number, start: number, end: number): void {
    const segments = Math.max(8, Math.ceil((Math.abs(end - start) / (Math.PI * 2)) * 64));
    const path: SubPath = { points: [], closed: true };
    for (let i = 0; i <= segments; i++) {
      const a = start + ((end - start) * i) / segments;
      path.points.push([(cx + Math.cos(a) * radius) * SS, (cy + Math.sin(a) * radius) * SS]);
    }
    this.subpaths.push(path);
    this.current = path;
  }

  roundRect(x: number, y: number, w: number, h: number, radius: number): void {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    const path: SubPath = { points: [], closed: true };
    if (r <= 0) {
      path.points.push(
        [x * SS, y * SS],
        [(x + w) * SS, y * SS],
        [(x + w) * SS, (y + h) * SS],
        [x * SS, (y + h) * SS]
      );
    } else {
      const corners: [number, number, number][] = [
        [x + w - r, y + r, -Math.PI / 2],
        [x + w - r, y + h - r, 0],
        [x + r, y + h - r, Math.PI / 2],
        [x + r, y + r, Math.PI],
      ];
      for (const [ccx, ccy, start] of corners) {
        for (let i = 0; i <= 8; i++) {
          const a = start + (Math.PI / 2) * (i / 8);
          path.points.push([(ccx + Math.cos(a) * r) * SS, (ccy + Math.sin(a) * r) * SS]);
        }
      }
    }
    this.subpaths.push(path);
    this.current = path;
  }

  fill(): void {
    if (this.subpaths.length === 0) return;
    this.fillSubpaths(this.subpaths, this.fillStyle);
  }

  clip(): void {
    const bounds = this.subpathsBounds(this.subpaths);
    if (!bounds) return;
    this.clipRect = {
      x0: Math.max(this.clipRect.x0, bounds.x0),
      y0: Math.max(this.clipRect.y0, bounds.y0),
      x1: Math.min(this.clipRect.x1, bounds.x1),
      y1: Math.min(this.clipRect.y1, bounds.y1),
    };
  }

  drawImage(image: { width: number; height: number; data: Uint8ClampedArray }, dx: number, dy: number, dw: number, dh: number): void {
    const x0 = Math.round(dx * SS);
    const y0 = Math.round(dy * SS);
    const w = Math.round(dw * SS);
    const h = Math.round(dh * SS);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tx = x0 + x;
        const ty = y0 + y;
        if (tx < this.clipRect.x0 || tx >= this.clipRect.x1 || ty < this.clipRect.y0 || ty >= this.clipRect.y1) continue;
        const sx = Math.min(image.width - 1, Math.floor((x / w) * image.width));
        const sy = Math.min(image.height - 1, Math.floor((y / h) * image.height));
        const si = (sy * image.width + sx) * 4;
        const di = (ty * this.bw + tx) * 4;
        this.buffer[di] = image.data[si];
        this.buffer[di + 1] = image.data[si + 1];
        this.buffer[di + 2] = image.data[si + 2];
        this.buffer[di + 3] = 255;
      }
    }
  }

  getImageData(x: number, y: number, w: number, h: number) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const px = (x + col) * SS + sx;
            const py = (y + row) * SS + sy;
            if (px < 0 || px >= this.bw || py < 0 || py >= this.bh) continue;
            const si = (py * this.bw + px) * 4;
            r += this.buffer[si];
            g += this.buffer[si + 1];
            b += this.buffer[si + 2];
            a += this.buffer[si + 3];
          }
        }
        const n = SS * SS;
        const di = (row * w + col) * 4;
        out[di] = r / n;
        out[di + 1] = g / n;
        out[di + 2] = b / n;
        out[di + 3] = a / n;
      }
    }
    return { data: out, width: w, height: h };
  }

  private colorAt(paint: Paint, px: number, py: number): [number, number, number] {
    if (paint instanceof Gradient) return paint.at(px / SS, py / SS);
    return parseColor(paint);
  }

  private paintRect(x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(this.clipRect.x0, Math.round(x));
    const y0 = Math.max(this.clipRect.y0, Math.round(y));
    const x1 = Math.min(this.clipRect.x1, Math.round(x + w));
    const y1 = Math.min(this.clipRect.y1, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) this.setPixel(px, py);
    }
  }

  private setPixel(px: number, py: number): void {
    const [r, g, b] = this.colorAt(this.fillStyle, px + 0.5, py + 0.5);
    const di = (py * this.bw + px) * 4;
    this.buffer[di] = r;
    this.buffer[di + 1] = g;
    this.buffer[di + 2] = b;
    this.buffer[di + 3] = 255;
  }

  private subpathsBounds(subpaths: SubPath[]) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const sub of subpaths) {
      for (const [px, py] of sub.points) {
        if (px < x0) x0 = px;
        if (py < y0) y0 = py;
        if (px > x1) x1 = px;
        if (py > y1) y1 = py;
      }
    }
    if (x0 === Infinity) return null;
    return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  /** Nonzero-winding scanline fill, matching the canvas default. */
  private fillSubpaths(subpaths: SubPath[], paint: Paint): void {
    const bounds = this.subpathsBounds(subpaths);
    if (!bounds) return;
    const startY = Math.max(this.clipRect.y0, Math.floor(bounds.y0));
    const endY = Math.min(this.clipRect.y1, Math.ceil(bounds.y1));

    for (let py = startY; py < endY; py++) {
      const sampleY = py + 0.5;
      const crossings: { x: number; dir: number }[] = [];
      for (const sub of subpaths) {
        const pts = sub.points;
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[(i + 1) % pts.length];
          if (i === pts.length - 1 && !sub.closed) continue;
          if (ay === by) continue;
          if (sampleY < Math.min(ay, by) || sampleY >= Math.max(ay, by)) continue;
          const t = (sampleY - ay) / (by - ay);
          crossings.push({ x: ax + (bx - ax) * t, dir: by > ay ? 1 : -1 });
        }
      }
      if (crossings.length < 2) continue;
      crossings.sort((a, b) => a.x - b.x);

      let winding = 0;
      for (let i = 0; i < crossings.length - 1; i++) {
        winding += crossings[i].dir;
        if (winding === 0) continue;
        const spanStart = Math.max(this.clipRect.x0, Math.ceil(crossings[i].x - 0.5));
        const spanEnd = Math.min(this.clipRect.x1, Math.ceil(crossings[i + 1].x - 0.5));
        for (let px = spanStart; px < spanEnd; px++) {
          const [r, g, b] = this.colorAt(paint, px + 0.5, py + 0.5);
          const di = (py * this.bw + px) * 4;
          this.buffer[di] = r;
          this.buffer[di + 1] = g;
          this.buffer[di + 2] = b;
          this.buffer[di + 3] = 255;
        }
      }
    }
  }
}

export class ShimCanvas {
  private _width: number;
  private _height: number;
  private _ctx: ShimContext;

  constructor(width = 300, height = 150) {
    this._width = width;
    this._height = height;
    this._ctx = new ShimContext(width, height);
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
    this._ctx = new ShimContext(value, this._height);
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
    this._ctx = new ShimContext(this._width, value);
  }

  getContext(): ShimContext {
    return this._ctx;
  }
}
