import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QRPayload, QRStyle, RenderInfo, VerifyResult, RecentQR } from './types';
import { validatePayload, buildQRString, checkCapacity, byteLength } from './utils/validators';
import { describePayload } from './utils/actions';
import { loadRecent, saveRecent, loadTheme, saveTheme, DEFAULT_STYLE, migrateStyle } from './utils/storage';
import { useLogoImage } from './hooks/useLogoImage';
import { diagnose, safeStyle } from './engines/diagnostics';
import InputPanel from './components/InputPanel';
import CustomizationPanel from './components/CustomizationPanel';
import QRPreview, { type QRPreviewHandle } from './components/QRPreview';
import ScanBadge from './components/ScanBadge';
import ActionPreview from './components/ActionPreview';
import DownloadPanel from './components/DownloadPanel';
import RecentCodes from './components/RecentCodes';
import BatchSheet from './components/BatchSheet';
import ScanTest from './components/ScanTest';
import { Sun, Moon, Lock, Layers, Square } from 'lucide-react';

type View = 'single' | 'sheet';

const EMPTY_RESULT: VerifyResult = {
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

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(loadTheme);
  const [view, setView] = useState<View>('single');
  const [payload, setPayload] = useState<QRPayload>({ type: 'url', url: '' });
  const [style, setStyle] = useState<QRStyle>(DEFAULT_STYLE);
  const [errors, setErrors] = useState(validatePayload(payload));
  const [activePreset, setActivePreset] = useState<string | null>('mono');
  const [info, setInfo] = useState<RenderInfo | null>(null);
  const [contrast, setContrast] = useState(0);
  const [verify, setVerify] = useState<VerifyResult>(EMPTY_RESULT);
  const [recentItems, setRecentItems] = useState<RecentQR[]>(loadRecent);
  const [toast, setToast] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const previewRef = useRef<QRPreviewHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const logoImage = useLogoImage(style.logo);

  const encoded = useMemo(() => {
    if (validatePayload(payload).length > 0) return '';
    return buildQRString(payload);
  }, [payload]);

  const capacity = useMemo(
    () => checkCapacity(encoded, style.errorCorrection),
    [encoded, style.errorCorrection]
  );
  const qrText = capacity.ok ? encoded : '';

  const action = useMemo(() => describePayload(payload, qrText), [payload, qrText]);

  const diagnosis = useMemo(
    () => diagnose(style, info, contrast, verify.status === 'idle' || verify.status === 'pending' ? null : verify),
    [style, info, contrast, verify]
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => setErrors(validatePayload(payload)), [payload]);

  const handleRestore = useCallback((p: QRPayload, s: QRStyle) => {
    setPayload(p);
    setStyle(migrateStyle(s));
    setActivePreset(null);
    setView('single');
  }, []);

  const handleApplySafeStyle = useCallback(() => {
    setStyle((previous) => safeStyle(previous));
    setActivePreset(null);
    notify('Applied square modules, square finders, level H and a full quiet zone');
  }, [notify]);

  // Debounced history snapshot, keyed on the exact code the user is looking at.
  useEffect(() => {
    if (!qrText) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const canvas = previewRef.current?.getCanvas();
      if (!canvas) return;
      const fingerprint = `${qrText}|${style.fgColor}|${style.bgColor}|${style.dotStyle}|${style.finderShape}|${style.gradientType}|${style.errorCorrection}|${style.margin}|${style.logoSize}`;
      const existing = loadRecent().find((item) => item.id === fingerprint);
      const item: RecentQR = {
        id: fingerprint,
        payload: { ...payload },
        style: { ...style, logo: null },
        dataUrl: canvas.toDataURL('image/png', 0.5),
        createdAt: existing ? existing.createdAt : Date.now(),
      };
      saveRecent(item);
      setRecentItems(loadRecent());
    }, 1400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [qrText, payload, style]);

  const bytes = qrText ? byteLength(qrText) : 0;

  return (
    <>
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">Q</div>
          <div>
            <h1 className="header-title">QR Studio</h1>
            <div className="header-subtitle">verified in the browser</div>
          </div>
        </div>

        <nav className="view-switch" role="tablist" aria-label="Mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'single'}
            className={`view-switch-btn ${view === 'single' ? 'active' : ''}`}
            onClick={() => setView('single')}
          >
            <Square size={13} /> One code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'sheet'}
            className={`view-switch-btn ${view === 'sheet' ? 'active' : ''}`}
            onClick={() => setView('sheet')}
          >
            <Layers size={13} /> Sheet
          </button>
        </nav>

        <div className="header-actions">
          <button type="button" className="theme-toggle" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} id="btn-theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      <div className="hero-section">
        <div className="hero-tag">QR code generator</div>
        <h2 className="hero-heading">
          Codes that <em>actually scan</em>
        </h2>
        <p className="hero-desc">
          Every code is decoded back out of its own pixels before you can download it, so you find out
          about a bad code here instead of after it is printed.
        </p>
      </div>

      <main className="app-layout">
        <div className="col-left">
          <section className="card">
            <div className="card-header">
              <div className="card-step">
                <span className="step-number">1</span>
                <span className="step-title">Choose the action</span>
              </div>
            </div>
            <div className="card-body">
              <InputPanel payload={payload} onChange={setPayload} errors={errors} onErrorsChange={setErrors} />
              {capacity.error && <div className="ec-warning"><span>{capacity.error}</span></div>}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="card-step">
                <span className="step-number">2</span>
                <span className="step-title">Style it</span>
              </div>
            </div>
            <div className="card-body">
              <CustomizationPanel
                style={style}
                onChange={setStyle}
                activePreset={activePreset}
                onPresetChange={setActivePreset}
                info={info}
              />
            </div>
          </section>
        </div>

        <div className="col-right">
          <section className="card">
            <div className="card-header">
              <div className="card-step">
                <span className="step-number">3</span>
                <span className="step-title">{view === 'single' ? 'Verify & export' : 'Build a sheet'}</span>
              </div>
            </div>
            <div className="card-body">
              {view === 'single' ? (
                <>
                  <QRPreview
                    ref={previewRef}
                    qrText={qrText}
                    style={style}
                    logoImage={logoImage}
                    onContrastChange={setContrast}
                    onInfo={setInfo}
                    onVerified={setVerify}
                  />

                  <ScanBadge
                    verify={verify}
                    diagnosis={diagnosis}
                    onFix={handleApplySafeStyle}
                    onOpenScanner={() => setScannerOpen(true)}
                  />

                  <div className="section-title">When someone scans it</div>
                  <ActionPreview action={action} />

                  <DownloadPanel
                    previewRef={previewRef}
                    qrText={qrText}
                    style={style}
                    hasContent={!!qrText}
                    verified={verify.status === 'pass'}
                    onNotice={notify}
                  />

                  {info && (
                    <div className="preview-meta">
                      <span>
                        {info.pixelSize}×{info.pixelSize}px
                      </span>
                      <span>
                        {info.moduleCount}×{info.moduleCount} modules · v{info.version} · {bytes}B
                      </span>
                    </div>
                  )}

                  <div className="privacy-note">
                    <Lock size={12} />
                    Rendering, verification and export all run in this tab. Nothing is uploaded.
                  </div>
                </>
              ) : (
                <BatchSheet payload={payload} encoded={encoded} style={style} logoImage={logoImage} />
              )}
            </div>
          </section>
        </div>
      </main>

      <RecentCodes items={recentItems} onRestore={handleRestore} onRefresh={() => setRecentItems(loadRecent())} />

      <footer className="site-footer">
        <span>Built with React, TypeScript, Canvas and a real QR decoder</span>
        <span className="footer-tech">v2.0</span>
      </footer>

      <div className={`copy-toast ${toast ? 'show' : ''}`}>{toast}</div>

      {scannerOpen && (
        <ScanTest expected={qrText} onClose={() => setScannerOpen(false)} />
      )}
    </>
  );
}