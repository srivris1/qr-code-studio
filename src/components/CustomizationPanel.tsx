import type { QRStyle, DotStyle } from '../types';
import { Upload, X } from 'lucide-react';

interface Props {
  style: QRStyle;
  onChange: (s: QRStyle) => void;
  activePreset: string | null;
  onPresetChange: (id: string | null) => void;
  logoCoverage: number;
}

const DOT_STYLES: { id: DotStyle; label: string; icon: string }[] = [
  { id: 'square', label: 'Square', icon: '■' },
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'rounded', label: 'Rounded', icon: '▢' },
  { id: 'diamond', label: 'Diamond', icon: '◆' },
  { id: 'star', label: 'Star', icon: '★' },
];

const PRESETS: { id: string; name: string; emoji: string; fg: string; bg: string; dot: DotStyle }[] = [
  { id: 'neon', name: 'Neon', emoji: '⚡', fg: '#a855f7', bg: '#0f0a1e', dot: 'circle' },
  { id: 'obsidian', name: 'Obsidian', emoji: '🌙', fg: '#e2e8f0', bg: '#0f172a', dot: 'rounded' },
  { id: 'cloud', name: 'Cloud', emoji: '☁️', fg: '#4285f4', bg: '#f8f9fa', dot: 'rounded' },
  { id: 'emerald', name: 'Emerald', emoji: '💎', fg: '#059669', bg: '#f0fdf4', dot: 'circle' },
  { id: 'sunset', name: 'Sunset', emoji: '🌅', fg: '#ea580c', bg: '#fffbeb', dot: 'rounded' },
  { id: 'mono', name: 'Classic', emoji: '◼', fg: '#000000', bg: '#ffffff', dot: 'square' },
];

const EC_LEVELS = [
  { value: 'L', label: 'L', sub: '~7%' },
  { value: 'M', label: 'M', sub: '~15%' },
  { value: 'Q', label: 'Q', sub: '~25%' },
  { value: 'H', label: 'H', sub: '~30%' },
];

const EC_CAPACITY: Record<string, number> = { L: 7, M: 15, Q: 25, H: 30 };

export default function CustomizationPanel({ style, onChange, activePreset, onPresetChange, logoCoverage }: Props) {
  const update = (patch: Partial<QRStyle>) => {
    onChange({ ...style, ...patch });
    onPresetChange(null);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    onChange({
      ...style,
      fgColor: preset.fg,
      bgColor: preset.bg,
      dotStyle: preset.dot,
      gradientType: 'none',
    });
    onPresetChange(preset.id);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ logo: reader.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeLogo = () => update({ logo: null });

  const ecCapacity = EC_CAPACITY[style.errorCorrection] || 15;
  const logoOverCapacity = logoCoverage > ecCapacity;

  return (
    <div>
      <div className="section-title">Presets</div>
      <div className="preset-grid">
        {PRESETS.map(p => (
          <button
            key={p.id}
            className={`preset-card ${activePreset === p.id ? 'active' : ''}`}
            onClick={() => applyPreset(p)}
          >
            <span className="preset-emoji">{p.emoji}</span>
            <span className="preset-name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="section-title">Dot pattern</div>
      <div className="dot-style-grid">
        {DOT_STYLES.map(d => (
          <button
            key={d.id}
            className={`dot-style-btn ${style.dotStyle === d.id ? 'active' : ''}`}
            onClick={() => update({ dotStyle: d.id })}
            title={d.label}
          >
            {d.icon}
          </button>
        ))}
      </div>

      <div className="section-title">Colors</div>
      <div className="gradient-toggle">
        {(['none', 'linear', 'radial'] as const).map(type => (
          <button
            key={type}
            className={`gradient-toggle-btn ${style.gradientType === type ? 'active' : ''}`}
            onClick={() => update({ gradientType: type })}
          >
            {type === 'none' ? 'Solid' : type === 'linear' ? 'Linear' : 'Radial'}
          </button>
        ))}
      </div>

      {style.gradientType === 'none' ? (
        <>
          <div className="form-group">
            <label className="form-label">Foreground</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input type="color" value={style.fgColor} onChange={e => update({ fgColor: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.fgColor} onChange={e => update({ fgColor: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Background</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input type="color" value={style.bgColor} onChange={e => update({ bgColor: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.bgColor} onChange={e => update({ bgColor: e.target.value })} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">Gradient start</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input type="color" value={style.gradientColor1} onChange={e => update({ gradientColor1: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.gradientColor1} onChange={e => update({ gradientColor1: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gradient end</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input type="color" value={style.gradientColor2} onChange={e => update({ gradientColor2: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.gradientColor2} onChange={e => update({ gradientColor2: e.target.value })} />
            </div>
          </div>
          {style.gradientType === 'linear' && (
            <div className="slider-group">
              <div className="slider-header">
                <span className="slider-label">Angle</span>
                <span className="slider-value">{style.gradientAngle}°</span>
              </div>
              <input type="range" min={0} max={360} value={style.gradientAngle} onChange={e => update({ gradientAngle: Number(e.target.value) })} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Background</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input type="color" value={style.bgColor} onChange={e => update({ bgColor: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.bgColor} onChange={e => update({ bgColor: e.target.value })} />
            </div>
          </div>
        </>
      )}

      <div className="section-title">Error correction</div>
      <div className="ec-level-grid">
        {EC_LEVELS.map(ec => (
          <button
            key={ec.value}
            className={`ec-btn ${style.errorCorrection === ec.value ? 'active' : ''}`}
            onClick={() => update({ errorCorrection: ec.value })}
          >
            <span className="ec-btn-label">{ec.label}</span>
            <span className="ec-btn-sub">{ec.sub}</span>
          </button>
        ))}
      </div>

      <div className="section-title">Logo overlay</div>
      {!style.logo ? (
        <label className="logo-upload-area">
          <Upload size={18} className="logo-upload-icon" />
          <div className="logo-upload-text">Click to upload a logo</div>
          <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
        </label>
      ) : (
        <div className="logo-upload-area has-logo">
          <img src={style.logo} alt="Logo" className="logo-preview" />
          <div className="logo-upload-text">Logo uploaded</div>
          <button className="logo-remove-btn" onClick={removeLogo}><X size={10} /></button>
        </div>
      )}

      {style.logo && (
        <>
          <div className="slider-group" style={{ marginTop: 10 }}>
            <div className="slider-header">
              <span className="slider-label">Logo size</span>
              <span className="slider-value">{style.logoSize}%</span>
            </div>
            <input type="range" min={8} max={35} value={style.logoSize} onChange={e => update({ logoSize: Number(e.target.value) })} />
          </div>
          <div className="slider-group">
            <div className="slider-header">
              <span className="slider-label">Padding</span>
              <span className="slider-value">{style.logoPadding}px</span>
            </div>
            <input type="range" min={0} max={20} value={style.logoPadding} onChange={e => update({ logoPadding: Number(e.target.value) })} />
          </div>
        </>
      )}

      {logoOverCapacity && (
        <div className="ec-warning">
          ⚠ Logo covers ~{logoCoverage.toFixed(0)}% of modules but EC level {style.errorCorrection} only recovers {ecCapacity}%. Consider upgrading to a higher error correction level.
        </div>
      )}

      <div className="section-title">Size & margin</div>
      <div className="slider-group">
        <div className="slider-header">
          <span className="slider-label">Canvas size</span>
          <span className="slider-value">{style.size}px</span>
        </div>
        <input type="range" min={256} max={2048} step={64} value={style.size} onChange={e => update({ size: Number(e.target.value) })} />
      </div>
      <div className="slider-group">
        <div className="slider-header">
          <span className="slider-label">Quiet zone</span>
          <span className="slider-value">{style.margin} modules</span>
        </div>
        <input type="range" min={0} max={8} value={style.margin} onChange={e => update({ margin: Number(e.target.value) })} />
      </div>
    </div>
  );
}
