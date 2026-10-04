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

const SHAPES: { id: DotStyle; label: string; icon: string; risky?: boolean }[] = [
  { id: 'square', label: 'Square — safest', icon: '■' },
  { id: 'connected', label: 'Connected — joined, rounded', icon: '⬢' },
  { id: 'rounded', label: 'Rounded', icon: '▢' },
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'diamond', label: 'Diamond — sparse, fragile', icon: '◆', risky: true },
  { id: 'star', label: 'Star — sparse, fragile', icon: '★', risky: true },
];

const FINDERS: { id: FinderShape; label: string }[] = [
  { id: 'square', label: 'SQUARE' },
  { id: 'rounded', label: 'ROUND' },
  { id: 'circle', label: 'CIRCLE' },
];

const PALETTES: { id: string; name: string; glyph: string; fg: string; bg: string; dot: DotStyle; finder: FinderShape }[] = [
  { id: 'mono', name: 'mono', glyph: '◼', fg: '#000000', bg: '#ffffff', dot: 'square', finder: 'square' },
  { id: 'phosphor', name: 'phosphor', glyph: '▚', fg: '#00e584', bg: '#050807', dot: 'connected', finder: 'rounded' },
  { id: 'ink', name: 'ink', glyph: '▤', fg: '#111827', bg: '#f5f5f4', dot: 'connected', finder: 'rounded' },
  { id: 'moss', name: 'moss', glyph: '▧', fg: '#14532d', bg: '#ecfdf5', dot: 'circle', finder: 'circle' },
  { id: 'ember', name: 'ember', glyph: '▨', fg: '#7c2d12', bg: '#fff7ed', dot: 'rounded', finder: 'rounded' },
  { id: 'void', name: 'void', glyph: '▓', fg: '#e6f5ec', bg: '#0b1220', dot: 'diamond', finder: 'square' },
];

const EC_LEVELS: { value: QRStyle['errorCorrection']; recovery: number }[] = [
  { value: 'L', recovery: 7 },
  { value: 'M', recovery: 15 },
  { value: 'Q', recovery: 25 },
  { value: 'H', recovery: 30 },
];

const EC_RECOVERY: Record<QRStyle['errorCorrection'], number> = { L: 7, M: 15, Q: 25, H: 30 };

function ColorRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="color-row">
        <div className="color-pick">
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </div>
    </div>
  );
}

export default function CustomizationPanel({ style, onChange, activePreset, onPresetChange, info }: Props) {
  const update = (patch: Partial<QRStyle>) => {
    onChange({ ...style, ...patch });
    onPresetChange(null);
  };

  const applyPalette = (palette: (typeof PALETTES)[number]) => {
    onChange({
      ...style,
      fgColor: palette.fg,
      bgColor: palette.bg,
      dotStyle: palette.dot,
      finderShape: palette.finder,
      gradientType: 'none',
    });
    onPresetChange(palette.id);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.size > 512 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => update({ logo: reader.result as string });
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const recovery = EC_RECOVERY[style.errorCorrection];
  const coverage = info ? computeLogoCoverage(info.moduleCount, style.logoSize, style.logoPadding, info.cell) : 0;
  const overCapacity = Boolean(style.logo) && coverage > recovery;

  return (
    <div>
      <div className="section-label">
        <span className="tag">02A</span> palette
      </div>
      <div className="swatches">
        {PALETTES.map((palette) => (
          <button
            key={palette.id}
            type="button"
            className={`swatch ${activePreset === palette.id ? 'active' : ''}`}
            onClick={() => applyPalette(palette)}
          >
            <span className="chip" style={{ background: palette.bg, color: palette.fg }}>
              {palette.glyph}
            </span>
            <span className="name">{palette.name}</span>
          </button>
        ))}
      </div>

      <div className="section-label">
        <span className="tag">02B</span> data module shape
      </div>
      <div className="shape-grid">
        {SHAPES.map((shape) => (
          <button
            key={shape.id}
            type="button"
            className={`shape-btn ${style.dotStyle === shape.id ? 'active' : ''}`}
            onClick={() => update({ dotStyle: shape.id })}
            title={shape.label}
          >
            {shape.icon}
          </button>
        ))}
      </div>
      <p className="hint">
        Applies to data modules only. The three finder patterns always render as exact geometry — that
        1:1:3:1:1 run-length ratio is what a scanner locks onto.
      </p>

      <div className="section-label">
        <span className="tag">02C</span> finder shape
      </div>
      <div className="seg">
        {FINDERS.map((finder) => (
          <button
            key={finder.id}
            type="button"
            className={style.finderShape === finder.id ? 'active' : ''}
            onClick={() => update({ finderShape: finder.id })}
          >
            {finder.label}
          </button>
        ))}
      </div>

      <div className="section-label">
        <span className="tag">02D</span> fill
      </div>
      <div className="seg">
        {(['none', 'linear', 'radial'] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={style.gradientType === type ? 'active' : ''}
            onClick={() => update({ gradientType: type })}
          >
            {type === 'none' ? 'SOLID' : type === 'linear' ? 'LINEAR' : 'RADIAL'}
          </button>
        ))}
      </div>

      {style.gradientType === 'none' ? (
        <ColorRow id="fg-color" label="Foreground" value={style.fgColor} onChange={(v) => update({ fgColor: v })} />
      ) : (
        <>
          <ColorRow
            id="grad-1"
            label="Gradient start"
            value={style.gradientColor1}
            onChange={(v) => update({ gradientColor1: v })}
          />
          <ColorRow
            id="grad-2"
            label="Gradient end"
            value={style.gradientColor2}
            onChange={(v) => update({ gradientColor2: v })}
          />
        </>
      )}
      <ColorRow id="bg-color" label="Background" value={style.bgColor} onChange={(v) => update({ bgColor: v })} />

      {style.gradientType === 'linear' && (
        <div className="slider">
          <div className="slider-head">
            <span>angle</span>
            <span className="val">{style.gradientAngle}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={style.gradientAngle}
            onChange={(e) => update({ gradientAngle: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="section-label">
        <span className="tag">02E</span> error correction
      </div>
      <div className="seg">
        {EC_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            className={style.errorCorrection === level.value ? 'active' : ''}
            onClick={() => update({ errorCorrection: level.value })}
          >
            {level.value} · {level.recovery}%
          </button>
        ))}
      </div>
      <p className="hint">
        Recovery is the share of damaged codewords the symbol can repair. H whenever a logo is involved.
      </p>

      <div className="section-label">
        <span className="tag">02F</span> logo
      </div>
      {!style.logo ? (
        <label className="drop">
          <Upload size={17} />
          <div className="t">upload logo · max 512 kb</div>
          <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
        </label>
      ) : (
        <div className="drop filled">
          <img src={style.logo} alt="Uploaded logo" />
          <div className="t">logo applied</div>
          <button type="button" className="drop-x" onClick={() => update({ logo: null })} aria-label="Remove logo">
            <X size={10} />
          </button>
        </div>
      )}

      {style.logo && (
        <>
          <div className="slider" style={{ marginTop: 12 }}>
            <div className="slider-head">
              <span>logo size</span>
              <span className="val">{style.logoSize}%</span>
            </div>
            <input
              type="range"
              min={8}
              max={35}
              value={style.logoSize}
              onChange={(e) => update({ logoSize: Number(e.target.value) })}
            />
          </div>
          <div className="slider">
            <div className="slider-head">
              <span>plate padding</span>
              <span className="val">{style.logoPadding}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              value={style.logoPadding}
              onChange={(e) => update({ logoPadding: Number(e.target.value) })}
            />
          </div>
          <p className="hint">
            plate hides ~<code>{coverage.toFixed(0)}%</code> of the code · level {style.errorCorrection}{' '}
            recovers {recovery}%
          </p>
        </>
      )}

      {overCapacity && (
        <div className="alert">
          <TriangleAlert size={13} />
          <span>
            The plate covers ~{coverage.toFixed(0)}% but level {style.errorCorrection} only recovers{' '}
            {recovery}%. Go to level H or shrink the logo.
          </span>
        </div>
      )}

      <div className="section-label">
        <span className="tag">02G</span> output grid
      </div>
      <div className="slider">
        <div className="slider-head">
          <span>export size</span>
          <span className="val">{info ? `${info.pixelSize}px` : `${style.size}px`}</span>
        </div>
        <input
          type="range"
          min={256}
          max={2048}
          step={64}
          value={style.size}
          onChange={(e) => update({ size: Number(e.target.value) })}
        />
        {info && (
          <p className="hint">
            snapped to whole modules — {info.moduleCount}×{info.moduleCount} at {info.cell}px each
            {info.pixelSize !== style.size ? ` (asked ${style.size})` : ''}
          </p>
        )}
      </div>
      <div className="slider">
        <div className="slider-head">
          <span>quiet zone</span>
          <span className="val">{style.margin} mod</span>
        </div>
        <input
          type="range"
          min={0}
          max={8}
          value={style.margin}
          onChange={(e) => update({ margin: Number(e.target.value) })}
        />
        {style.margin < 4 && <p className="hint warn">spec requires 4. Below that, detection fails on most phones.</p>}
      </div>
    </div>
  );
}