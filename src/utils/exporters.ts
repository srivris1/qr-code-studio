export async function exportAsPNG(canvas: HTMLCanvasElement, filename: string, scale: number = 1): Promise<void> {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width * scale;
  exportCanvas.height = canvas.height * scale;
  const ctx = exportCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = exportCanvas.toDataURL('image/png', 1.0);
  link.click();
}

export function exportAsSVG(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export function generateSVGString(
  modules: boolean[][],
  size: number,
  fgColor: string,
  bgColor: string,
  margin: number,
  dotStyle: string
): string {
  const moduleCount = modules.length;
  const totalModules = moduleCount + margin * 2;
  const cellSize = size / totalModules;
  let paths = '';

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules[row][col]) continue;
      const x = (col + margin) * cellSize;
      const y = (row + margin) * cellSize;

      switch (dotStyle) {
        case 'circle':
          paths += `<circle cx="${x + cellSize / 2}" cy="${y + cellSize / 2}" r="${cellSize * 0.42}" fill="${fgColor}"/>`;
          break;
        case 'rounded':
          paths += `<rect x="${x + cellSize * 0.05}" y="${y + cellSize * 0.05}" width="${cellSize * 0.9}" height="${cellSize * 0.9}" rx="${cellSize * 0.3}" fill="${fgColor}"/>`;
          break;
        case 'diamond': {
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const r = cellSize * 0.45;
          paths += `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${fgColor}"/>`;
          break;
        }
        case 'star': {
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const outer = cellSize * 0.48;
          const inner = cellSize * 0.22;
          let points = '';
          for (let i = 0; i < 5; i++) {
            const aOuter = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5;
            const aInner = aOuter + Math.PI / 5;
            points += `${cx + Math.cos(aOuter) * outer},${cy + Math.sin(aOuter) * outer} `;
            points += `${cx + Math.cos(aInner) * inner},${cy + Math.sin(aInner) * inner} `;
          }
          paths += `<polygon points="${points.trim()}" fill="${fgColor}"/>`;
          break;
        }
        default:
          paths += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fgColor}"/>`;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${bgColor}"/>
${paths}
</svg>`;
}
