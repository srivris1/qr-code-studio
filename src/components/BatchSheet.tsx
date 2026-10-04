import { useEffect, useMemo, useState } from 'react';
import type { QRStyle, SheetConfig, SheetItem, QRPayload } from '../types';
import { renderQR } from '../engines/qr-renderer';
import { applySheetTemplate, defaultSheetTemplate } from '../utils/actions';
import { downloadText, exportAsPNG, composeSheetCanvas, timestamp } from '../utils/exporters';
import { Printer, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';

interface Props {
  payload: QRPayload;
  encoded: string;
  style: QRStyle;
  logoImage: HTMLImageElement | null;
}

const MAX_ITEMS = 300;

export const DEFAULT_SHEET: SheetConfig = {
  count: 24,
  start: 1,
  template: '',
  labelTemplate: '#{{n}}',
  codeSize: 240,
  columns: 6,
};

function buildItems(
  config: SheetConfig,
  encoded: string,
  style: QRStyle,
  logoImage: HTMLImageElement | null
): SheetItem[] {
  const template = config.template || encoded || '{{n}}';
  const count = Math.max(1, Math.min(MAX_ITEMS, Math.floor(config.count) || 1));
  const sheetStyle: QRStyle = { ...style, size: config.codeSize, logoSize: Math.min(style.logoSize, 22) };
  const items: SheetItem[] = [];

  for (let offset = 0; offset < count; offset++) {
    const index = config.start + offset;
    const label = applySheetTemplate(config.labelTemplate || `#${index}`, index, String(index));
    const value = applySheetTemplate(template, index, label);
    const canvas = document.createElement('canvas');
    if (!renderQR(canvas, value, sheetStyle, logoImage)) continue;
    items.push({ index, label, value, dataUrl: canvas.toDataURL('image/png') });
  }

  return items;
}

function NumField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function BatchSheet({ payload, encoded, style, logoImage }: Props) {
  const [config, setConfig] = useState<SheetConfig>(DEFAULT_SHEET);
  const [items, setItems] = useState<SheetItem[]>([]);
  const [busy, setBusy] = useState(false);

  const fallbackTemplate = useMemo(() => defaultSheetTemplate(payload), [payload]);
  const patch = (next: Partial<SheetConfig>) => setConfig((previous) => ({ ...previous, ...next }));

  useEffect(() => {
    setConfig((previous) =>
      previous.template === '' ? { ...previous, template: fallbackTemplate } : previous
    );
  }, [fallbackTemplate]);

  useEffect(() => {
    if (!encoded.trim()) {
      setItems([]);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      setItems(buildItems(config, encoded, style, logoImage));
      setBusy(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [config, encoded, style, logoImage]);

  const handleDownloadSheet = () => {
    if (items.length === 0) return;
    const sheetStyle: QRStyle = { ...style, size: config.codeSize, logoSize: Math.min(style.logoSize, 22) };
    const canvases = items.map((item) => {
      const canvas = document.createElement('canvas');
      renderQR(canvas, item.value, sheetStyle, logoImage);
      return canvas;
    });
    const composed = composeSheetCanvas(canvases, config.columns, config.codeSize, 0);
    if (composed) exportAsPNG(composed, `qr-sheet-${timestamp()}`);
  };

  const handleDownloadCsv = () => {
    if (items.length === 0) return;
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ['index', 'label', 'payload'].join(','),
      ...items.map((item) => [item.index, item.label, item.value].map(escape).join(',')),
    ];
    downloadText(rows.join('\n'), `qr-sheet-${timestamp()}.csv`, 'text/csv');
  };

  const empty = items.length === 0;

  return (
    <div className="sheet">
      <div className="section-label">
        <span className="tag">03S</span> numbering template
      </div>

      <div className="sheet-fields">
        <div className="field">
          <label htmlFor="sheet-template">payload template</label>
          <input
            id="sheet-template"
            className="input"
            value={config.template}
            placeholder={fallbackTemplate}
            onChange={(e) => patch({ template: e.target.value })}
            spellCheck={false}
          />
          <p className="hint">
            <code>{'{{n}}'}</code> number · <code>{'{{label}}'}</code> label
          </p>
        </div>

        <div className="field">
          <label htmlFor="sheet-label">caption template</label>
          <input
            id="sheet-label"
            className="input"
            value={config.labelTemplate}
            onChange={(e) => patch({ labelTemplate: e.target.value })}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="section-label">
        <span className="tag">03T</span> run size
      </div>
      <div className="sheet-nums">
        <NumField id="sheet-count" label="codes" value={config.count} min={1} max={MAX_ITEMS} onChange={(v) => patch({ count: v })} />
        <NumField id="sheet-start" label="starts at" value={config.start} min={0} onChange={(v) => patch({ start: v })} />
        <NumField id="sheet-columns" label="per row" value={config.columns} min={1} max={12} onChange={(v) => patch({ columns: Math.max(1, v || 1) })} />
        <NumField id="sheet-size" label="code px" value={config.codeSize} min={120} max={1024} onChange={(v) => patch({ codeSize: v })} />
      </div>

      <div className="sheet-actions">
        <button type="button" className="cmd primary" disabled={empty} onClick={() => window.print()}>
          <Printer size={12} /> print
        </button>
        <button type="button" className="cmd" disabled={empty} onClick={handleDownloadSheet}>
          <ImageIcon size={12} /> png
        </button>
        <button type="button" className="cmd" disabled={empty} onClick={handleDownloadCsv}>
          <FileSpreadsheet size={12} /> csv
        </button>
      </div>

      {empty ? (
        <div className="sheet-blank">{busy ? 'building run…' : 'enter a payload to generate a numbered run'}</div>
      ) : (
        <>
          <div className="sheet-summary">
            <b>{items.length}</b> codes · {items[0].label} → {items[items.length - 1].label} ·{' '}
            <code>{items[0].value}</code>
          </div>
          <div className="sheet-grid" style={{ gridTemplateColumns: `repeat(${config.columns}, 1fr)` }}>
            {items.map((item) => (
              <figure className="sheet-cell" key={item.index}>
                <img src={item.dataUrl} alt={`QR code ${item.index}`} loading="lazy" />
                <figcaption>{item.label}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  );
}