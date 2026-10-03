import type { QRStyle } from '../types';

export function exportAsPNG(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function exportAs4KPNG(canvas: HTMLCanvasElement, filename: string): void {
  const scale = 4;
  const upscaled = document.createElement('canvas');
  upscaled.width = canvas.width * scale;
  upscaled.height = canvas.height * scale;
  const ctx = upscaled.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, upscaled.width, upscaled.height);
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = upscaled.toDataURL('image/png');
  link.click();
}

export function exportAsSVG(
  _canvas: HTMLCanvasElement,
  _qrText: string,
  style: QRStyle,
  filename: string
): void {
  const size = style.size;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="${style.bgColor}"/>`;

  const imgData = _canvas.getContext('2d')!.getImageData(0, 0, _canvas.width, _canvas.height);
  const cellSize = 4;
  const step = Math.max(1, Math.floor(_canvas.width / (size / cellSize)));

  for (let y = 0; y < _canvas.height; y += step) {
    for (let x = 0; x < _canvas.width; x += step) {
      const idx = (y * _canvas.width + x) * 4;
      const r = imgData.data[idx];
      const g = imgData.data[idx + 1];
      const b = imgData.data[idx + 2];
      const brightness = (r + g + b) / 3;
      if (brightness < 128) {
        const svgX = (x / _canvas.width) * size;
        const svgY = (y / _canvas.height) * size;
        const dotSize = (step / _canvas.width) * size;
        svg += `<rect x="${svgX.toFixed(1)}" y="${svgY.toFixed(1)}" width="${dotSize.toFixed(1)}" height="${dotSize.toFixed(1)}" fill="${style.fgColor}"/>`;
      }
    }
  }

  svg += '</svg>';
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function copyToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed')), 'image/png');
    });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
