import type { QRStyle, DotStyle, FinderShape, RenderInfo } from '../types';
import { computeLogoCoverage } from '../engines/qr-renderer';
import { Upload, X, TriangleAlert } from 'lucide-react';

interface Props {
  style: QRStyle;
  onChange: (s: QRStyle) => void;
  activePreset: string | null;
  onPresetChange: (id: string | null) => void;
  info: RenderInfo | null;
}

const DOT_STYLES: { id: DotStyle; label: string; icon: string }[] = [
  { id: 'square', label: 'Square — safest', icon: '■' },
  { id: 'connected', label: 'Connected — rounded and joined', icon: '⬢' },
  { id: 'rounded', label: 'Rounded', icon: '▢' },
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'diamond', label: 'Diamond — fragile', icon: '◆' },
  { id: 'star', label: 'Star — fragile', icon: '★' },
];

const FINDER_SHAPES: { id: FinderShape; label: string }[] = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'circle', label: 'Circle' },
];

const PRESETS: { id: string; name: string; emoji: string; fg: string; bg: string; dot: DotStyle; finder: FinderShape }[] = [
  { id: 'mono', name: 'Classic', emoji: '◼', fg: '#000000', bg: '#ffffff', dot: 'square', finder: 'square' },
  { id: 'ink', name: 'Ink', emoji: '🖊', fg: '#111827', bg: '#f5f5f4', dot: 'connected', finder: 'rounded' },
  { id: 'moss', name: 'Moss', emoji: '🌿', fg: '#14532d', bg: '#ecfdf5', dot: 'circle', finder: 'circle' },
  { id: 'ember', name: 'Ember', emoji: '🔥', fg: '#7c2d12', bg: '#fff7ed', dot: 'rounded', finder: 'rounded' },
  { id: 'indigo', name: 'Indigo', emoji: '🔮', fg: '#312e81', bg: '#eef2ff', dot: 'diamond', finder: 'square' },
  { id: 'mono-light', name: 'Inverse', emoji: '🌙', fg: '#e2e8f0', bg: '#0f172a', dot: 'connected', finder: 'rounded' },
];

const EC_LEVELS: { value: QRStyle['errorCorrection']; sub: string }[] = [
  { value: 'L', sub: '7%' },
  { value: 'M', sub: '15%' },
  { value: 'Q', sub: '25%' },
  { value: 'H', sub: '30%' },
];

const EC_RECOVERY: Record<QRStyle['errorCorrection'], number> = { L: 7, M: 15, Q: 25, H: 30 };

export default function CustomizationPanel({ style, onChange, activePreset, onPresetChange, info }: Props) {
  const update = (patch: Partial<QRStyle>) => {
    onChange({ ...style, ...patch });
    onPresetChange(null);
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    onChange({
      ...style,
      fgColor: preset.fg,
      bgColor: preset.bg,
      dotStyle: preset.dot,
      finderShape: preset.finder,
      gradientType: 'none',
    });
    onPresetChange(preset.id);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => update({ logo: reader.result as string });
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const recovery = EC_RECOVERY[style.errorCorrection];
  const coverage = info ? computeLogoCoverage(info.moduleCount, style.logoSize, style.logoPadding, info.cell) : 0;
  const logoOverCapacity = Boolean(style.logo) && coverage > recovery;

  return (
    <div>
      <div className="section-title">Look</div>
      <div className="preset-grid">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-card ${activePreset === preset.id ? 'active' : ''}`}
            onClick={() => applyPreset(preset)}
          >
            <span className="preset-emoji">{preset.emoji}</span>
            <span className="preset-name">{preset.name}</span>
          </button>
        ))}
      </div>

      <div className="section-title">Module shape</div>
      <div className="dot-style-grid">
        {DOT_STYLES.map((dot) => (
          <button
            key={dot.id}
            type="button"
            className={`dot-style-btn ${style.dotStyle === dot.id ? 'active' : ''}`}
            onClick={() => update({ dotStyle: dot.id })}
            title={dot.label}
          >
            {dot.icon}
          </button>
        ))}
      </div>
      <p className="field-hint">
        Shapes apply to data modules only. The three finder patterns are always drawn exact — that is what a
        scanner locks onto.
      </p>

      <div className="section-title">Finder shape</div>
      <div className="segment-row">
        {FINDER_SHAPES.map((shape) => (
          <button
            key={shape.id}
            type="button"
            className={`segment-btn ${style.finderShape === shape.id ? 'active' : ''}`}
            onClick={() => update({ finderShape: shape.id })}
          >
            {shape.label}
          </button>
        ))}
      </div>

      <div className="section-title">Colour</div>
      <div className="segment-row">
        {(['none', 'linear', 'radial'] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={`segment-btn ${style.gradientType === type ? 'active' : ''}`}
            onClick={() => update({ gradientType: type })}
          >
            {type === 'none' ? 'Solid' : type === 'linear' ? 'Linear' : 'Radial'}
          </button>
        ))}
      </div>

      <div className="form-group">
        {style.gradientType === 'none' ? (
          <>
            <label className="form-label" htmlFor="fg-color">Foreground</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input id="fg-color" type="color" value={style.fgColor} onChange={(e) => update({ fgColor: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.fgColor} onChange={(e) => update({ fgColor: e.target.value })} />
            </div>
          </>
        ) : (
          <>
            <label className="form-label" htmlFor="grad-1">Gradient start</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input id="grad-1" type="color" value={style.gradientColor1} onChange={(e) => update({ gradientColor1: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.gradientColor1} onChange={(e) => update({ gradientColor1: e.target.value })} />
            </div>
            <label className="form-label" htmlFor="grad-2" style={{ marginTop: 8 }}>Gradient end</label>
            <div className="color-row">
              <div className="color-picker-wrapper">
                <input id="grad-2" type="color" value={style.gradientColor2} onChange={(e) => update({ gradientColor2: e.target.value })} />
              </div>
              <input className="form-input color-hex-input" value={style.gradientColor2} onChange={(e) => update({ gradientColor2: e.target.value })} />
            </div>
          </>
        )}
        <label className="form-label" htmlFor="bg-color" style={{ marginTop: 8 }}>Background</label>
        <div className="color-row">
          <div className="color-picker-wrapper">
            <input id="bg-color" type="color" value={style.bgColor} onChange={(e) => update({ bgColor: e.target.value })} />
          </div>
          <input className="form-input color-hex-input" value={style.bgColor} onChange={(e) => update({ bgColor: e.target.value })} />
        </div>
      </div>

      {style.gradientType === 'linear' && (
        <div className="slider-group">
          <div className="slider-header">
            <span className="slider-label">Angle</span>
            <span className="slider-value">{style.gradientAngle}°</span>
          </div>
          <input type="range" min={0} max={360} value={style.gradientAngle} onChange={(e) => update({ gradientAngle: Number(e.target.value) })} />
        </div>
      )}

      <div className="section-title">Error correction</div>
      <div className="ec-level-grid">
        {EC_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            className={`ec-btn ${style.errorCorrection === level.value ? 'active' : ''}`}
            onClick={() => update({ errorCorrection: level.value })}
          >
            <span className="ec-btn-label">{level.value}</span>
            <span className="ec-btn-sub">{level.sub}</span>
          </button>
        ))}
      </div>
      <p className="field-hint">
        Higher levels survive more damage but make the code denser. H is the right choice whenever a logo is
        involved.
      </p>

      <div className="section-title">Logo</div>
      {!style.logo ? (
        <label className="logo-upload-area">
          <Upload size={18} className="logo-upload-icon" />
          <div className="logo-upload-text">Upload a logo (max 512 KB)</div>
          <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
        </label>
      ) : (
        <div className="logo-upload-area has-logo">
          <img src={style.logo} alt="Uploaded logo" className="logo-preview" />
          <div className="logo-upload-text">Logo applied</div>
          <button type="button" className="logo-remove-btn" onClick={() => update({ logo: null })} aria-label="Remove logo">
            <X size={10} />
          </button>
        </div>
      )}

      {style.logo && (
        <>
          <div className="slider-group" style={{ marginTop: 10 }}>
            <div className="slider-header">
              <span className="slider-label">Logo size</span>
              <span className="slider-value">{style.logoSize}%</span>
            </div>
            <input type="range" min={8} max={35} value={style.logoSize} onChange={(e) => update({ logoSize: Number(e.target.value) })} />
          </div>
          <div className="slider-group">
            <div className="slider-header">
              <span className="slider-label">Padding</span>
              <span className="slider-value">{style.logoPadding}px</span>
            </div>
            <input type="range" min={0} max={20} value={style.logoPadding} onChange={(e) => update({ logoPadding: Number(e.target.value) })} />
          </div>
          <p className="field-hint">
            Hides about <strong>{coverage.toFixed(0)}%</strong> of the code. Level {style.errorCorrection} recovers{' '}
            {recovery}%.
          </p>
        </>
      )}

      {logoOverCapacity && (
        <div className="ec-warning">
          <TriangleAlert size={13} style={{ flexShrink: 0 }} />
          <span>
            The logo covers ~{coverage.toFixed(0)}% of the code but level {style.errorCorrection} only recovers{' '}
            {recovery}%. Use level H or shrink the logo.
          </span>
        </div>
      )}

      <div className="section-title">Size &amp; quiet zone</div>
      <div className="slider-group">
        <div className="slider-header">
          <span className="slider-label">Export size</span>
          <span className="slider-value">
            {info ? `${info.pixelSize}px` : `${style.size}px`}
          </span>
        </div>
        <input type="range" min={256} max={2048} step={64} value={style.size} onChange={(e) => update({ size: Number(e.target.value) })} />
        {info && (
          <p className="field-hint">
            Snapped to a whole-module grid: {info.moduleCount}×{info.moduleCount} modules at {info.cell}px each
            {info.pixelSize !== style.size ? ` (${style.size} requested)` : ''}.
          </p>
        )}
      </div>
      <div className="slider-group">
        <div className="slider-header">
          <span className="slider-label">Quiet zone</span>
          <span className="slider-value">{style.margin} modules</span>
        </div>
        <input type="range" min={0} max={8} value={style.margin} onChange={(e) => update({ margin: Number(e.target.value) })} />
        {style.margin < 4 && <p className="field-hint warn">Below 4 modules breaks detection on most phones.</p>}
      </div>
    </div>
  );
}