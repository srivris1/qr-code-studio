import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QRPayload, QRStyle, RenderInfo, VerifyResult, RecentQR, TapeLine, TapeTone } from './types';
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
import DecodeTape from './components/DecodeTape';
import ScanTest from './components/ScanTest';
import { Sun, Moon, Lock, Check } from 'lucide-react';

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

const MAX_TAPE = 12;

function clockStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'paper'>(loadTheme);
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
  const [tape, setTape] = useState<TapeLine[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const previewRef = useRef<QRPreviewHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const tapeSeq = useRef(0);
  const lastPayload = useRef<string>('');
  const logoImage = useLogoImage(style.logo);

  const push = useCallback((text: string, tone: TapeTone = 'dim') => {
    const line: TapeLine = { id: ++tapeSeq.current, at: clockStamp(), text, tone };
    setTape((previous) => [...previous.slice(-(MAX_TAPE - 1)), line]);
  }, []);

  const encoded = useMemo(
    () => (validatePayload(payload).length > 0 ? '' : buildQRString(payload)),
    [payload]
  );

  const capacity = useMemo(() => checkCapacity(encoded, style.errorCorrection), [encoded, style.errorCorrection]);
  const qrText = capacity.ok ? encoded : '';
  const bytes = qrText ? byteLength(qrText) : 0;
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

  // Log tape: encoder state, payload edits and decode outcomes.
  useEffect(() => {
    if (!info) return;
    push(`encode v${info.version} · ${info.moduleCount}×${info.moduleCount} · ec:${style.errorCorrection} · cell ${info.cell}px`);
  }, [info?.version, info?.moduleCount, info?.cell, style.errorCorrection, push]);

  useEffect(() => {
    if (!qrText || qrText === lastPayload.current) return;
    const timer = setTimeout(() => {
      lastPayload.current = qrText;
      push(`payload ${bytes}B · "${qrText.slice(0, 64)}${qrText.length > 64 ? '…' : ''}"`);
    }, 500);
    return () => clearTimeout(timer);
  }, [qrText, bytes, push]);

  useEffect(() => {
    if (verify.status === 'pass') {
      push(`decode ok · ${verify.decodeMs}ms · v${verify.version} · payload match`, 'ok');
    } else if (verify.status === 'fail') {
      push(
        verify.decoded
          ? `decode mismatch → "${verify.decoded.slice(0, 40)}"`
          : 'decode fail → no finder pattern located',
        'bad'
      );
    }
  }, [verify.status, verify.decodeMs, verify.version, verify.decoded, push]);

  const handleRestore = useCallback((p: QRPayload, s: QRStyle) => {
    setPayload(p);
    setStyle(migrateStyle(s));
    setActivePreset(null);
    setView('single');
    push('restored from history');
  }, [push]);

  const handleApplySafeStyle = useCallback(() => {
    setStyle((previous) => safeStyle(previous));
    setActivePreset(null);
    push('applied safe style · square modules/finders · ec:H · quiet zone 4', 'warn');
    notify('Applied square modules, square finders, level H and a full quiet zone');
  }, [notify, push]);

  useEffect(() => {
    if (!qrText) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      const canvas = previewRef.current?.getCanvas();
      if (!canvas) return;
      const fingerprint = `${qrText}|${style.fgColor}|${style.bgColor}|${style.dotStyle}|${style.finderShape}|${style.gradientType}|${style.errorCorrection}|${style.margin}|${style.logoSize}`;
      const existing = loadRecent().find((item) => item.id === fingerprint);
      saveRecent({
        id: fingerprint,
        payload: { ...payload },
        style: { ...style, logo: null },
        dataUrl: canvas.toDataURL('image/png', 0.5),
        createdAt: existing ? existing.createdAt : Date.now(),
      });
      setRecentItems(loadRecent());
    }, 1400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [qrText, payload, style]);

  const led =
    verify.status === 'pass' ? 'pass' : verify.status === 'fail' ? 'fail' : verify.status === 'pending' ? 'busy' : '';
  const ledText =
    verify.status === 'pass'
      ? 'verified'
      : verify.status === 'fail'
        ? 'decode fail'
        : verify.status === 'pending'
          ? 'decoding'
          : 'standby';

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
          <div className="brand-text">
            <h1>QR STUDIO</h1>
            <span>scan verification bench</span>
          </div>
        </div>

        <nav className="view-switch" role="tablist" aria-label="Mode">
          <button role="tab" type="button" aria-selected={view === 'single'} onClick={() => setView('single')}>
            ONE
          </button>
          <button role="tab" type="button" aria-selected={view === 'sheet'} onClick={() => setView('sheet')}>
            SHEET
          </button>
        </nav>

        <div className="topbar-right">
          <div className={`led ${led}`}>
            <b />
            {ledText}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'paper' : 'dark'))}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <div className="telemetry">
        <div className="tcell">
          <i>VER</i>
          <b>{info ? `v${info.version}` : '--'}</b>
        </div>
        <div className="tcell">
          <i>MODULES</i>
          <b>{info ? `${info.moduleCount}×${info.moduleCount}` : '--'}</b>
        </div>
        <div className="tcell">
          <i>EC</i>
          <b>{style.errorCorrection}</b>
        </div>
        <div className="tcell">
          <i>QUIET</i>
          <b>{style.margin}</b>
        </div>
        <div className="tcell">
          <i>OUTPUT</i>
          <b>{info ? `${info.pixelSize}px` : '--'}</b>
        </div>
        <div className={`tcell ${contrast >= 4.5 ? 'good' : contrast > 0 ? 'bad' : ''}`}>
          <i>CONTRAST</i>
          <b>{contrast > 0 ? `${contrast.toFixed(1)}:1` : '--'}</b>
        </div>
        <div className="tcell">
          <i>BYTES</i>
          <b>{bytes || '--'}</b>
        </div>
        <div className="tcell grow">
          <i>TARGET</i>
          <b>{qrText || '—'}</b>
        </div>
      </div>

      <div className="intro">
        <div>
          <div className="intro-kicker">decode-before-deliver</div>
          <h2>
            A QR code that <em>does not scan</em> is a bug, not a design choice.
          </h2>
          <p>
            Every code is rendered, downsampled the way a camera sees it, and read back by a real
            decoder before you are allowed to trust it. Finder patterns stay exact. Modules land on
            whole pixels. Exports are re-rendered from the matrix, not upscaled.
          </p>
        </div>
        <div className="intro-stats">
          <div className="intro-stat">
            <b>0</b>
            <span>server calls</span>
          </div>
          <div className="intro-stat">
            <b>3</b>
            <span>finders locked</span>
          </div>
          <div className="intro-stat">
            <b>1:1</b>
            <span>verified round-trip</span>
          </div>
        </div>
      </div>

      <main className="workspace">
        <div className="col">
          <section className="panel">
            <div className="panel-head">
              <div className="panel-step">
                <span className="idx">01</span>
                <h3>Action</h3>
              </div>
              <span className="note">what it triggers</span>
            </div>
            <div className="panel-body">
              <InputPanel payload={payload} onChange={setPayload} errors={errors} onErrorsChange={setErrors} />
              {capacity.error && (
                <div className="alert">
                  <span>{capacity.error}</span>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div className="panel-step">
                <span className="idx">02</span>
                <h3>Appearance</h3>
              </div>
              <span className="note">finders stay exact</span>
            </div>
            <div className="panel-body">
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

        <div className="col">
          <section className="panel">
            <div className="panel-head">
              <div className="panel-step">
                <span className="idx">03</span>
                <h3>{view === 'single' ? 'Verify & export' : 'Batch sheet'}</h3>
              </div>
              <span className="note">{view === 'single' ? 'round-trip decode' : 'numbered run'}</span>
            </div>
            <div className="panel-body">
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

                  <div className="section-label">
                    <span className="tag">03A</span> receiver
                  </div>
                  <ActionPreview action={action} />

                  <DownloadPanel
                    previewRef={previewRef}
                    qrText={qrText}
                    style={style}
                    hasContent={!!qrText}
                    verified={verify.status === 'pass'}
                    onNotice={notify}
                  />

                  <DecodeTape lines={tape} />

                  <div className="alert" style={{ borderColor: 'var(--line)', borderLeftColor: 'var(--signal)', background: 'var(--signal-glow)', color: 'var(--txt-3)' }}>
                    <Lock size={12} />
                    <span>Rendering, decoding and export all run in this tab. Nothing is uploaded.</span>
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

      <footer className="foot">
        <span>react · typescript · canvas · jsqr worker</span>
        <span>v2.1 · everything runs client-side</span>
      </footer>

      <div className={`toast ${toast ? 'show' : ''}`}>
        <Check size={12} />
        {toast}
      </div>

      {scannerOpen && <ScanTest expected={qrText} onClose={() => setScannerOpen(false)} />}
    </>
  );
}