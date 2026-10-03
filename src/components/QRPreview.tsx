import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import type { QRStyle, RenderInfo, VerifyResult } from '../types';
import { renderQR, computeContrastRatio } from '../engines/qr-renderer';
import { sampleModules, decodePixels } from '../engines/verifier';
import { QrCode } from 'lucide-react';

export interface QRPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getInfo: () => RenderInfo | null;
  /** Re-renders from the module matrix at an exact pixel size, for print export. */
  renderAt: (targetSize: number) => HTMLCanvasElement | null;
}

interface Props {
  qrText: string;
  style: QRStyle;
  logoImage: HTMLImageElement | null;
  onContrastChange: (ratio: number) => void;
  onInfo: (info: RenderInfo | null) => void;
  onVerified: (result: VerifyResult) => void;
}

const IDLE_RESULT: VerifyResult = {
  status: 'idle',
  ok: false,
  decoded: null,
  expected: '',
  decodeMs: 0,
  version: null,
  contrastRatio: 0,
  moduleCount: 0,
  pixelSize: 0,
  issues: [],
};

const QRPreview = forwardRef<QRPreviewHandle, Props>(
  ({ qrText, style, logoImage, onContrastChange, onInfo, onVerified }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const infoRef = useRef<RenderInfo | null>(null);
    const latest = useRef({ qrText, style, logoImage });
    const runId = useRef(0);

    latest.current = { qrText, style, logoImage };

    useImperativeHandle(
      ref,
      () => ({
        getCanvas: () => canvasRef.current,
        getInfo: () => infoRef.current,
        renderAt: (targetSize: number) => {
          const { qrText: text, style: currentStyle, logoImage: logo } = latest.current;
          if (!text) return null;
          const canvas = document.createElement('canvas');
          const info = renderQR(canvas, text, { ...currentStyle, size: targetSize }, logo);
          return info ? canvas : null;
        },
      }),
      []
    );

    useEffect(() => {
      const canvas = canvasRef.current;

      // With no payload the canvas is unmounted entirely, so reset here or the
      // panel keeps showing the previous code's verdict.
      if (!canvas) {
        runId.current++;
        onContrastChange(0);
        onInfo(null);
        onVerified(IDLE_RESULT);
        return;
      }

      const currentRun = ++runId.current;
      const info = renderQR(canvas, qrText, style, logoImage);
      infoRef.current = info;

      // A gradient is only as readable as its weakest stop, so measure that.
      const foreground =
        style.gradientType !== 'none'
          ? computeContrastRatio(style.gradientColor1, style.bgColor) <=
            computeContrastRatio(style.gradientColor2, style.bgColor)
            ? style.gradientColor1
            : style.gradientColor2
          : style.fgColor;
      const contrast = computeContrastRatio(foreground, style.bgColor);
      onContrastChange(Math.round(contrast * 10) / 10);
      onInfo(info);

      if (!info || !qrText) {
        onVerified(IDLE_RESULT);
        return;
      }

      onVerified({ ...IDLE_RESULT, status: 'pending', expected: qrText, contrastRatio: contrast });

      const timer = setTimeout(() => {
        const sampled = sampleModules(canvas, info.totalModules);
        if (!sampled) return;
        decodePixels(sampled.data, sampled.width, sampled.height, qrText).then((response) => {
          if (currentRun !== runId.current) return;
          onVerified({
            status: response.ok ? 'pass' : 'fail',
            ok: response.ok,
            decoded: response.decoded,
            expected: qrText,
            decodeMs: response.decodeMs,
            version: response.version,
            contrastRatio: contrast,
            moduleCount: info.moduleCount,
            pixelSize: info.pixelSize,
            issues: [],
          });
        });
      }, 200);

      return () => clearTimeout(timer);
    }, [qrText, style, logoImage, onContrastChange, onInfo, onVerified]);

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
      </div>
    );
  }
);

QRPreview.displayName = 'QRPreview';

export default QRPreview;