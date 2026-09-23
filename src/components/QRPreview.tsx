import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import type { QRStyle } from '../types';
import { renderQR, computeContrastRatio } from '../engines/qr-renderer';
import { QrCode } from 'lucide-react';

export interface QRPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getModules: () => boolean[][] | null;
}

interface Props {
  qrText: string;
  style: QRStyle;
  onScanResult: (result: { contrastRatio: number; score: number }) => void;
  onModulesGenerated: (moduleCount: number) => void;
}

const QRPreview = forwardRef<QRPreviewHandle, Props>(({ qrText, style, onScanResult, onModulesGenerated }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasContent, setHasContent] = useState(false);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getModules: () => modulesRef.current,
  }));

  const modulesRef = useRef<boolean[][] | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const modules = renderQR(canvas, qrText, style);
    modulesRef.current = modules;
    setHasContent(!!modules);

    if (modules) {
      onModulesGenerated(modules.length);

      const fgColor = style.gradientType !== 'none' ? style.gradientColor1 : style.fgColor;
      const contrast = computeContrastRatio(fgColor, style.bgColor);

      let score = 100;
      if (contrast < 2) score = 15;
      else if (contrast < 3) score = 40;
      else if (contrast < 4.5) score = 65;
      else if (contrast < 7) score = 82;
      else score = 96;

      if (style.logo) {
        const logoPenalty = Math.max(0, (style.logoSize - 15) * 2);
        score = Math.max(10, score - logoPenalty);
      }

      if (style.margin < 2) {
        score = Math.max(10, score - 8);
      }

      onScanResult({ contrastRatio: contrast, score });
    }
  }, [qrText, style, onScanResult, onModulesGenerated]);

  return (
    <div className="qr-preview-container">
      <div className="qr-canvas-wrapper">
        {!hasContent && (
          <div className="qr-empty-state">
            <QrCode size={64} className="qr-empty-icon" />
            <span className="qr-empty-text">Enter content to generate QR code</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ display: hasContent ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
});

QRPreview.displayName = 'QRPreview';

export default QRPreview;
