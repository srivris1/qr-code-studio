import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import type { QRStyle } from '../types';
import { renderQR, computeContrastRatio } from '../engines/qr-renderer';
import { QrCode } from 'lucide-react';

export interface QRPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

interface Props {
  qrText: string;
  style: QRStyle;
  onScanResult: (result: { contrastRatio: number; score: number }) => void;
  onModulesGenerated: (count: number) => void;
}

const QRPreview = forwardRef<QRPreviewHandle, Props>(({ qrText, style, onScanResult, onModulesGenerated }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    if (!canvasRef.current) return;

    const modules = renderQR(canvasRef.current, qrText, style);
    if (modules) {
      onModulesGenerated(modules.length);
    }

    const fgColor = style.gradientType !== 'none' ? style.gradientColor1 : style.fgColor;
    const contrast = computeContrastRatio(fgColor, style.bgColor);

    let score = 0;
    const contrastScore = Math.min((contrast / 7) * 40, 40);
    const marginScore = Math.min((style.margin / 4) * 30, 30);
    let logoScore = 30;
    if (style.logo) {
      const logoArea = style.logoSize * style.logoSize / 100;
      logoScore = Math.max(30 - logoArea * 3, 0);
    }
    score = Math.round(contrastScore + marginScore + logoScore);

    onScanResult({ contrastRatio: Math.round(contrast * 10) / 10, score });
  }, [qrText, style, onScanResult, onModulesGenerated]);

  if (!qrText) {
    return (
      <div className="qr-empty-state">
        <QrCode size={48} className="qr-empty-icon" />
        <div className="qr-empty-text">Enter data to generate a QR code</div>
      </div>
    );
  }

  return (
    <div className="qr-preview-container">
      <div className="qr-canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>
      <div className="preview-meta">
        <span>{style.size}×{style.size}px</span>
        <span>EC: {style.errorCorrection}</span>
      </div>
    </div>
  );
});

export default QRPreview;
