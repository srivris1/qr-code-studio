import { useCallback, useRef } from 'react';
import type { QRStyle, QRPreset, DotStyle, ErrorCorrectionLevel, GradientType } from '../types';
import { Upload, X } from 'lucide-react';

interface Props {
  style: QRStyle;
  onChange: (style: QRStyle) => void;
  activePreset: string | null;
  onPresetChange: (id: string | null) => void;
  logoCoverage: number;
}

const PRESETS: QRPreset[] = [
  { id: 'cyberpunk', name: 'Cyberpunk Neon', emoji: '🌆',
    style: { fgColor: '#e040fb', bgColor: '#0a0014', dotStyle: 'circle', gradientType: 'linear', gradientColor1: '#e040fb', gradientColor2: '#00e5ff', gradientAngle: 135 } },
  { id: 'midnight', name: 'Midnight Obsidian', emoji: '🌑',
    style: { fgColor: '#c0c0c8', bgColor: '#0a0a10', dotStyle: 'rounded', gradientType: 'none' } },
  { id: 'gcloud', name: 'Google Cloud', emoji: '☁️',
    style: { fgColor: '#4285f4', bgColor: '#ffffff', dotStyle: 'rounded', gradientType: 'linear', gradientColor1: '#4285f4', gradientColor2: '#34a853', gradientAngle: 135 } },
  { id: 'emerald', name: 'Minimal Emerald', emoji: '💎',
    style: { fgColor: '#10b981', bgColor: '#022c22', dotStyle: 'circle', gradientType: 'none' } },
  { id: 'sunset', name: 'Sunset Horizon', emoji: '🌅',
    style: { fgColor: '#f97316', bgColor: '#1c1017', dotStyle: 'rounded', gradientType: 'linear', gradientColor1: '#f97316', gradientColor2: '#ec4899', gradientAngle: 45 } },
  { id: 'mono', name: 'Monochrome Print', emoji: '🖨️',
    style: { fgColor: '#000000', bgColor: '#ffffff', dotStyle: 'square', gradientType: 'none' } },
];

const DOT_STYLES: { style: DotStyle; label: string }[] = [
  { style: 'square', label: '■' },
  { style: 'circle', label: '●' },
  { style: 'rounded', label: '▢' },
  { style: 'diamond', label: '◆' },
  { style: 'star', label: '★' },
];

const EC_LEVELS: { level: ErrorCorrectionLevel; label: string; pct: string }[] = [
  { level: 'L', label: 'Low', pct: '~7%' },
  { level: 'M', label: 'Med', pct: '~15%' },
  { level: 'Q', label: 'High', pct: '~25%' },
  { level: 'H', label: 'Max', pct: '~30%' },
];

export default function CustomizationPanel({ style, onChange, activePreset, onPresetChange, logoCoverage }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof QRStyle>(key: K, value: QRStyle[K]) => {
    onPresetChange(null);
    onChange({ ...style, [key]: value });
  }, [style, onChange, onPresetChange]);

  const applyPreset = useCallback((preset: QRPreset) => {
    onPresetChange(preset.id);
    onChange({ ...style, ...preset.style });
  }, [style, onChange, onPresetChange]);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      set('logo', ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [set]);

  const removeLogo = useCallback(() => {
    set('logo', null);
    if (fileRef.current) fileRef.current.value = '';
  }, [set]);

  const ecWarningNeeded = style.logo && logoCoverage > 0;
  const recommendedEC = logoCoverage > 25 ? 'H' : logoCoverage > 15 ? 'Q' : logoCoverage > 7 ? 'M' : 'L';
  const ecTooLow = ecWarningNeeded && EC_LEVELS.findIndex(e => e.level === style.errorCorrection) < EC_LEVELS.findIndex(e => e.level === recommendedEC);

  return (
    <div>
      <div className="section-block">
        <div className="section-title">Presets</div>
        <div className="preset-grid">
          {PRESETS.map(p => (
            <button
              key={p.id}
              id={`preset-${p.id}`}
              className={`preset-card ${activePreset === p.id ? 'active' : ''}`}
              onClick={() => applyPreset(p)}
            >
              <span className="preset-emoji">{p.emoji}</span>
              <span className="preset-name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">Dot Pattern</div>
        <div className="dot-style-grid">
          {DOT_STYLES.map(d => (
            <button
              key={d.style}
              id={`dot-${d.style}`}
              className={`dot-style-btn ${style.dotStyle === d.style ? 'active' : ''}`}
              onClick={() => set('dotStyle', d.style)}
              title={d.style}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">Colors</div>

        <div className="gradient-toggle">
          {(['none', 'linear', 'radial'] as GradientType[]).map(gt => (
            <button
              key={gt}
              className={`gradient-toggle-btn ${style.gradientType === gt ? 'active' : ''}`}
              onClick={() => set('gradientType', gt)}
            >
              {gt === 'none' ? 'Solid' : gt === 'linear' ? 'Linear' : 'Radial'}
            </button>
          ))}
        </div>

        {style.gradientType === 'none' ? (
          <div className="form-group">
            <label className="form-label">Foreground</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input type="color" value={style.fgColor} onChange={e => set('fgColor', e.target.value)} />
              </div>
              <input
                className="form-input color-hex-input"
                value={style.fgColor}
                onChange={e => set('fgColor', e.target.value)}
                maxLength={7}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Gradient Start</label>
              <div className="color-row">
                <div className="color-picker-wrapper">
                  <input type="color" value={style.gradientColor1} onChange={e => set('gradientColor1', e.target.value)} />
                </div>
                <input
                  className="form-input color-hex-input"
                  value={style.gradientColor1}
                  onChange={e => set('gradientColor1', e.target.value)}
                  maxLength={7}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Gradient End</label>
              <div className="color-row">
                <div className="color-picker-wrapper">
                  <input type="color" value={style.gradientColor2} onChange={e => set('gradientColor2', e.target.value)} />
                </div>
                <input
                  className="form-input color-hex-input"
                  value={style.gradientColor2}
                  onChange={e => set('gradientColor2', e.target.value)}
                  maxLength={7}
                />
              </div>
            </div>
            {style.gradientType === 'linear' && (
              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-label">Angle</span>
                  <span className="slider-value">{style.gradientAngle}°</span>
                </div>
                <input type="range" min="0" max="360" value={style.gradientAngle} onChange={e => set('gradientAngle', Number(e.target.value))} />
              </div>
            )}
          </>
        )}

        <div className="form-group">
          <label className="form-label">Background</label>
          <div className="color-row">
            <div className="color-picker-wrapper">
              <input type="color" value={style.bgColor} onChange={e => set('bgColor', e.target.value)} />
            </div>
            <input
              className="form-input color-hex-input"
              value={style.bgColor}
              onChange={e => set('bgColor', e.target.value)}
              maxLength={7}
            />
          </div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">Error Correction</div>
        <div className="ec-level-grid">
          {EC_LEVELS.map(ec => (
            <button
              key={ec.level}
              id={`ec-${ec.level}`}
              className={`ec-btn ${style.errorCorrection === ec.level ? 'active' : ''}`}
              onClick={() => set('errorCorrection', ec.level)}
            >
              <span className="ec-btn-label">{ec.level}</span>
              <span className="ec-btn-sub">{ec.pct}</span>
            </button>
          ))}
        </div>
        {ecTooLow && (
          <div className="ec-warning">
            ⚠️ Logo covers ~{logoCoverage.toFixed(0)}% of modules. Recommended: Level {recommendedEC} for scan reliability.
          </div>
        )}
      </div>

      <div className="section-block">
        <div className="section-title">Size & Margin</div>
        <div className="slider-group">
          <div className="slider-header">
            <span className="slider-label">QR Size</span>
            <span className="slider-value">{style.size}px</span>
          </div>
          <input type="range" min="256" max="2048" step="64" value={style.size} onChange={e => set('size', Number(e.target.value))} />
        </div>
        <div className="slider-group">
          <div className="slider-header">
            <span className="slider-label">Quiet Zone</span>
            <span className="slider-value">{style.margin} modules</span>
          </div>
          <input type="range" min="0" max="8" value={style.margin} onChange={e => set('margin', Number(e.target.value))} />
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">Logo Embed</div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        <div className={`logo-upload-area ${style.logo ? 'has-logo' : ''}`} onClick={() => fileRef.current?.click()}>
          {style.logo ? (
            <>
              <img src={style.logo} alt="Logo" className="logo-preview" />
              <div className="logo-upload-text">Click to change</div>
              <button className="logo-remove-btn" onClick={e => { e.stopPropagation(); removeLogo(); }}>
                <X size={10} />
              </button>
            </>
          ) : (
            <>
              <Upload size={24} className="logo-upload-icon" />
              <div className="logo-upload-text">Click or drop logo image</div>
            </>
          )}
        </div>
        {style.logo && (
          <>
            <div className="slider-group" style={{ marginTop: 12 }}>
              <div className="slider-header">
                <span className="slider-label">Logo Size</span>
                <span className="slider-value">{style.logoSize}%</span>
              </div>
              <input type="range" min="5" max="35" value={style.logoSize} onChange={e => set('logoSize', Number(e.target.value))} />
            </div>
            <div className="slider-group">
              <div className="slider-header">
                <span className="slider-label">Padding</span>
                <span className="slider-value">{style.logoPadding}px</span>
              </div>
              <input type="range" min="0" max="20" value={style.logoPadding} onChange={e => set('logoPadding', Number(e.target.value))} />
            </div>
            <div className="slider-group">
              <div className="slider-header">
                <span className="slider-label">Corner Radius</span>
                <span className="slider-value">{style.logoBorderRadius}px</span>
              </div>
              <input type="range" min="0" max="30" value={style.logoBorderRadius} onChange={e => set('logoBorderRadius', Number(e.target.value))} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
