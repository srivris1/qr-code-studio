import { Download, Copy, FileImage, FileCode } from 'lucide-react';
import { exportAsPNG, exportAsSVG, copyToClipboard, generateSVGString } from '../utils/exporters';
import type { QRStyle } from '../types';
import { generateMatrix } from '../engines/qr-renderer';

interface Props {
  canvasRef: React.RefObject<{ getCanvas: () => HTMLCanvasElement | null; getModules: () => boolean[][] | null } | null>;
  qrText: string;
  style: QRStyle;
  hasContent: boolean;
  onCopySuccess: () => void;
}

export default function DownloadPanel({ canvasRef, qrText, style, hasContent, onCopySuccess }: Props) {
  const handlePNG = async (scale: number, label: string) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    await exportAsPNG(canvas, `qr-code-${label}`, scale);
  };

  const handleSVG = () => {
    if (!qrText) return;
    try {
      const { modules } = generateMatrix(qrText, style.errorCorrection);
      const fgColor = style.gradientType !== 'none' ? style.gradientColor1 : style.fgColor;
      const svg = generateSVGString(modules, style.size, fgColor, style.bgColor, style.margin, style.dotStyle);
      exportAsSVG(svg, 'qr-code-vector');
    } catch {
      return;
    }
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const ok = await copyToClipboard(canvas);
    if (ok) onCopySuccess();
  };

  return (
    <div className="download-grid">
      <button className="download-btn primary" disabled={!hasContent} onClick={() => handlePNG(1, 'standard')} id="btn-download-png">
        <Download size={16} />
        PNG
      </button>
      <button className="download-btn" disabled={!hasContent} onClick={handleSVG} id="btn-download-svg">
        <FileCode size={16} />
        SVG
      </button>
      <button className="download-btn" disabled={!hasContent} onClick={() => handlePNG(4, '4k')} id="btn-download-4k">
        <FileImage size={16} />
        4K PNG
      </button>
      <button className="download-btn" disabled={!hasContent} onClick={handleCopy} id="btn-copy-clipboard">
        <Copy size={16} />
        Copy
      </button>
    </div>
  );
}
