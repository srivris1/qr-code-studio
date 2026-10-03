import type { QRStyle } from '../types';
import type { QRPreviewHandle } from './QRPreview';
import { exportAsPNG, exportAtSize, exportAsSVG, copyToClipboard, copyTextToClipboard, timestamp } from '../utils/exporters';
import { renderQRToSVG } from '../engines/qr-renderer';
import { Download, Image, FileText, Copy, Maximize } from 'lucide-react';

interface Props {
  previewRef: React.RefObject<QRPreviewHandle | null>;
  qrText: string;
  style: QRStyle;
  hasContent: boolean;
  verified: boolean;
  onNotice: (message: string) => void;
}

export default function DownloadPanel({ previewRef, qrText, style, hasContent, verified, onNotice }: Props) {
  const disabled = !hasContent;
  const name = `qr-${timestamp()}`;

  return (
    <div className="download-grid">
      <button
        type="button"
        className="download-btn primary"
        disabled={disabled}
        onClick={() => {
          const canvas = previewRef.current?.getCanvas();
          if (canvas) exportAsPNG(canvas, name);
        }}
      >
        <Download size={13} /> PNG
      </button>

      <button
        type="button"
        className="download-btn"
        disabled={disabled}
        onClick={() => {
          const result = renderQRToSVG(qrText, style, style.logo);
          if (result) exportAsSVG(result.svg, name);
        }}
      >
        <FileText size={13} /> SVG
      </button>

      <button
        type="button"
        className="download-btn"
        disabled={disabled}
        onClick={() => {
          const handle = previewRef.current;
          if (!handle) return;
          if (!verified) onNotice('Exported anyway — the scan check has not passed.');
          exportAtSize((size) => handle.renderAt(size), `${name}-print`, 4096);
        }}
      >
        <Maximize size={13} /> 4K print
      </button>

      <button
        type="button"
        className="download-btn"
        disabled={disabled}
        onClick={async () => {
          const canvas = previewRef.current?.getCanvas();
          if (!canvas) return;
          const ok = await copyToClipboard(canvas);
          onNotice(ok ? 'Image copied to clipboard' : 'Clipboard blocked by the browser');
        }}
      >
        <Image size={13} /> Copy image
      </button>

      <button
        type="button"
        className="download-btn wide"
        disabled={disabled}
        onClick={async () => {
          const ok = await copyTextToClipboard(qrText);
          onNotice(ok ? 'Payload copied — this is what a scanner reads' : 'Clipboard blocked by the browser');
        }}
      >
        <Copy size={13} /> Copy payload
      </button>
    </div>
  );
}