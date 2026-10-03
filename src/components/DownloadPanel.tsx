import type { QRStyle } from '../types';
import type { QRPreviewHandle } from './QRPreview';
import { exportAsPNG, exportAs4KPNG, exportAsSVG, copyToClipboard } from '../utils/exporters';
import { Download, Image, FileText, Copy } from 'lucide-react';

interface Props {
  canvasRef: React.RefObject<QRPreviewHandle | null>;
  qrText: string;
  style: QRStyle;
  hasContent: boolean;
  onCopySuccess: () => void;
}

export default function DownloadPanel({ canvasRef, qrText, style, hasContent, onCopySuccess }: Props) {
  const getCanvas = () => canvasRef.current?.getCanvas() || null;
  const disabled = !hasContent;

  return (
    <div className="download-grid">
      <button
        className="download-btn primary"
        disabled={disabled}
        onClick={() => { const c = getCanvas(); if (c) exportAsPNG(c, 'qr-code'); }}
      >
        <Download size={13} /> PNG
      </button>
      <button
        className="download-btn"
        disabled={disabled}
        onClick={() => { const c = getCanvas(); if (c) exportAsSVG(c, qrText, style, 'qr-code'); }}
      >
        <FileText size={13} /> SVG
      </button>
      <button
        className="download-btn"
        disabled={disabled}
        onClick={() => { const c = getCanvas(); if (c) exportAs4KPNG(c, 'qr-code-4k'); }}
      >
        <Image size={13} /> 4K PNG
      </button>
      <button
        className="download-btn"
        disabled={disabled}
        onClick={async () => {
          const c = getCanvas();
          if (c) { const ok = await copyToClipboard(c); if (ok) onCopySuccess(); }
        }}
      >
        <Copy size={13} /> Copy
      </button>
    </div>
  );
}
