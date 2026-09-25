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
import { Sun, Moon } from 'lucide-react';

const DEFAULT_STYLE: QRStyle = {
  size: 512,
  fgColor: '#c0c0c8',
  bgColor: '#0a0a10',
  dotStyle: 'rounded',
  errorCorrection: 'M',
  margin: 4,
  gradientType: 'none',
  gradientColor1: '#818cf8',
  gradientColor2: '#22d3ee',
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
  const [activePreset, setActivePreset] = useState<string | null>('midnight');
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
            <h1 className="header-title">Pro QR Studio</h1>
            <p className="header-subtitle">Generate & Design Beautiful QR Codes</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme} id="btn-theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="app-layout">
        <aside className="panel panel-left">
          <InputPanel
            payload={payload}
            onChange={setPayload}
            errors={errors}
            onErrorsChange={setErrors}
          />
        </aside>

        <section className="panel panel-center">
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
        </section>

        <aside className="panel panel-right">
          <CustomizationPanel
            style={style}
            onChange={setStyle}
            activePreset={activePreset}
            onPresetChange={setActivePreset}
            logoCoverage={logoCoverage}
          />
        </aside>
      </main>

      <RecentCodes
        items={recentItems}
        onRestore={handleRestore}
        onRefresh={() => setRecentItems(loadRecent())}
      />

      <div className={`copy-toast ${showToast ? 'show' : ''}`}>
        ✓ Copied to clipboard
      </div>
    </>
  );
}
