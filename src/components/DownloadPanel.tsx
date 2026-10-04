import type { QRStyle } from '../types';
import type { QRPreviewHandle } from './QRPreview';
import { exportAsPNG, exportAtSize, exportAsSVG, copyToClipboard, copyTextToClipboard, timestamp } from '../utils/exporters';
import { renderQRToSVG } from '../engines/qr-renderer';
import { Download, Image, FileCode2, Maximize, Copy, Braces } from 'lucide-react';

interface Props {
  previewRef: React.RefObject<QRPreviewHandle | null>;
  qrText: string;
  style: QRStyle;
  hasContent: boolean;
  verified: boolean;
  onNotice: (message: string) => void;
}

export default function DownloadPanel({ previewRef, qrText, style, hasContent, verified, onNotice }: Props) {
  const off = !hasContent;
  const name = `qr-${timestamp()}`;

  return (
    <div className="cmd-grid">
      <button
        type="button"
        className="cmd primary"
        disabled={off}
        onClick={() => {
          const canvas = previewRef.current?.getCanvas();
          if (canvas) exportAsPNG(canvas, name);
        }}
      >
        <Download size={12} /> png
      </button>

      <button
        type="button"
        className="cmd"
        disabled={off}
        onClick={() => {
          const result = renderQRToSVG(qrText, style, style.logo);
          if (result) exportAsSVG(result.svg, name);
        }}
      >
        <FileCode2 size={12} /> svg
      </button>

      <button
        type="button"
        className="cmd"
        disabled={off}
        onClick={() => {
          const handle = previewRef.current;
          if (!handle) return;
          if (!verified) onNotice('exported anyway · scan check has not passed');
          exportAtSize((size) => handle.renderAt(size), `${name}-print`, 4096);
        }}
      >
        <Maximize size={12} /> 4k print
      </button>

      <button
        type="button"
        className="cmd"
        disabled={off}
        onClick={async () => {
          const canvas = previewRef.current?.getCanvas();
          if (!canvas) return;
          const ok = await copyToClipboard(canvas);
          onNotice(ok ? 'image copied' : 'clipboard blocked by browser');
        }}
      >
        <Image size={12} /> copy image
      </button>

      <button
        type="button"
        className="cmd span2"
        disabled={off}
        onClick={async () => {
          const ok = await copyTextToClipboard(qrText);
          onNotice(ok ? 'payload copied · this is what a scanner reads' : 'clipboard blocked by browser');
        }}
      >
        <Braces size={12} /> copy raw payload
      </button>
    </div>
  );
}