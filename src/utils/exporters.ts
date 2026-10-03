function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportAsPNG(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, `${filename}.png`);
  }, 'image/png');
}

/**
 * Re-renders from the module matrix at the requested size rather than scaling
 * the preview bitmap. Upscaling a 512px canvas cannot invent detail the preview
 * never had — printing needs each module to be a whole number of pixels.
 */
export function exportAtSize(
  renderAt: (targetSize: number) => HTMLCanvasElement | null,
  filename: string,
  targetSize = 4096
): void {
  const canvas = renderAt(targetSize);
  if (!canvas) return;
  exportAsPNG(canvas, filename);
}

export function exportAsSVG(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`);
}

export function downloadText(text: string, filename: string, mime: string): void {
  triggerDownload(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export async function copyToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed'))), 'image/png');
    });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Stitches rendered sheet tiles onto one canvas, wrapping at `columns`. */
export function composeSheetCanvas(
  tiles: HTMLCanvasElement[],
  columns: number,
  cell: number,
  labelHeight: number
): HTMLCanvasElement | null {
  if (tiles.length === 0) return null;
  const rows = Math.ceil(tiles.length / columns);
  const out = document.createElement('canvas');
  out.width = columns * cell;
  out.height = rows * (cell + labelHeight);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  tiles.forEach((tile, i) => {
    const x = (i % columns) * cell;
    const y = Math.floor(i / columns) * (cell + labelHeight);
    ctx.drawImage(tile, x, y, cell, cell);
  });
  return out;
}

export { timestamp };
