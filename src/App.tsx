import { useState, useRef, useCallback, useEffect } from 'react';
import type { QRPayload, QRStyle, ValidationError, RecentQR } from './types';
import { validatePayload, buildQRString } from './utils/validators';
import { loadRecent, saveRecent, loadTheme, saveTheme } from './utils/storage';
import { computeLogoCoverage } from './engines/qr-renderer';
import InputPanel from './components/InputPanel';
import CustomizationPanel from './components/CustomizationPanel';
import QRPreview, { type QRPreviewHandle } from './components/QRPreview';
import ScanBadge from './components/ScanBadge';
import DownloadPanel from './components/DownloadPanel';
import RecentCodes from './components/RecentCodes';
import { Sun, Moon, Lock } from 'lucide-react';

const DEFAULT_STYLE: QRStyle = {
  size: 512,
  fgColor: '#000000',
  bgColor: '#ffffff',
  dotStyle: 'square',
  errorCorrection: 'M',
  margin: 4,
  gradientType: 'none',
  gradientColor1: '#8ab48e',
  gradientColor2: '#4a8b6e',
  gradientAngle: 135,
  logo: null,
  logoSize: 18,
  logoPadding: 8,
  logoBorderRadius: 8,
};

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme);
  const [payload, setPayload] = useState<QRPayload>({ type: 'url', url: '' });
  const [style, setStyle] = useState<QRStyle>(DEFAULT_STYLE);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>('mono');
  const [scanResult, setScanResult] = useState({ contrastRatio: 0, score: 0 });
  const [moduleCount, setModuleCount] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentQR[]>(loadRecent);
  const [showToast, setShowToast] = useState(false);
  const previewRef = useRef<QRPreviewHandle>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const qrText = validatePayload(payload).length === 0 ? buildQRString(payload) : '';

  const handleScanResult = useCallback((result: { contrastRatio: number; score: number }) => {
    setScanResult(result);
  }, []);

  const handleModulesGenerated = useCallback((count: number) => {
    setModuleCount(count);
  }, []);

  const logoCoverage = style.logo && moduleCount > 0
    ? computeLogoCoverage(moduleCount, style.logoSize, style.logoPadding, style.size)
    : 0;

  useEffect(() => {
    if (!qrText) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      const canvas = previewRef.current?.getCanvas();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png', 0.6);
      const item: RecentQR = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        payload: { ...payload },
        style: { ...style, logo: null },
        dataUrl,
        createdAt: Date.now(),
      };
      saveRecent(item);
      setRecentItems(loadRecent());
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [qrText, payload, style]);

  const handleRestore = useCallback((p: QRPayload, s: QRStyle) => {
    setPayload(p);
    setStyle(s);
    setErrors([]);
    setActivePreset(null);
  }, []);

  const handleCopySuccess = useCallback(() => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }, []);

  return (
    <>
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">Q</div>
          <div>
            <h1 className="header-title">QR Studio</h1>
          </div>
        </div>
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme} id="btn-theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      <div className="hero-section">
        <div className="hero-tag">QR Code Generator</div>
        <h2 className="hero-heading">Design & generate <em>beautiful</em> QR codes</h2>
        <p className="hero-desc">
          Choose a data type, customize the appearance, and download your QR code. 
          Everything runs in your browser — no data is sent to any server.
        </p>
      </div>

      <main className="app-layout">
        <div className="col-left">
          <div className="card">
            <div className="card-header">
              <div className="card-step">
                <span className="step-number">1</span>
                <span className="step-title">Enter your data</span>
              </div>
            </div>
            <div className="card-body">
              <InputPanel
                payload={payload}
                onChange={setPayload}
                errors={errors}
                onErrorsChange={setErrors}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-step">
                <span className="step-number">2</span>
                <span className="step-title">Customize design</span>
              </div>
            </div>
            <div className="card-body">
              <CustomizationPanel
                style={style}
                onChange={setStyle}
                activePreset={activePreset}
                onPresetChange={setActivePreset}
                logoCoverage={logoCoverage}
              />
            </div>
          </div>
        </div>

        <div className="col-right">
          <div className="card">
            <div className="card-header">
              <div className="card-step">
                <span className="step-number">3</span>
                <span className="step-title">Preview & download</span>
              </div>
            </div>
            <div className="card-body">
              <QRPreview
                ref={previewRef}
                qrText={qrText}
                style={style}
                onScanResult={handleScanResult}
                onModulesGenerated={handleModulesGenerated}
              />

              <ScanBadge
                score={scanResult.score}
                contrastRatio={scanResult.contrastRatio}
                hasContent={!!qrText}
              />

              <DownloadPanel
                canvasRef={previewRef}
                qrText={qrText}
                style={style}
                hasContent={!!qrText}
                onCopySuccess={handleCopySuccess}
              />

              <div className="privacy-note">
                <Lock size={12} />
                All processing happens in your browser. No data leaves your device.
              </div>
            </div>
          </div>
        </div>
      </main>

      <RecentCodes
        items={recentItems}
        onRestore={handleRestore}
        onRefresh={() => setRecentItems(loadRecent())}
      />

      <footer className="site-footer">
        <span>Built with React, TypeScript & Canvas API</span>
        <span className="footer-tech">v1.0.0</span>
      </footer>

      <div className={`copy-toast ${showToast ? 'show' : ''}`}>
        ✓ Copied to clipboard
      </div>
    </>
  );
}
