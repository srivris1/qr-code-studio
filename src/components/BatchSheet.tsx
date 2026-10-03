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

export const DEFAULT_SHEET: SheetConfig = {
  count: 24,
  start: 1,
  template: '',
  labelTemplate: '#{{n}}',
  codeSize: 240,
  columns: 6,
};

const MAX_ITEMS = 300;

function buildItems(config: SheetConfig, encoded: string, style: QRStyle, logoImage: HTMLImageElement | null): SheetItem[] {
  const template = config.template || encoded || '{{n}}';
  const count = Math.max(1, Math.min(MAX_ITEMS, Math.floor(config.count) || 1));
  const items: SheetItem[] = [];
  const sheetStyle: QRStyle = { ...style, size: config.codeSize, logoSize: Math.min(style.logoSize, 22) };

  for (let offset = 0; offset < count; offset++) {
    const index = config.start + offset;
    const label = applySheetTemplate(config.labelTemplate || `#${index}`, index, String(index));
    const value = applySheetTemplate(template, index, label);
    const canvas = document.createElement('canvas');
    const info = renderQR(canvas, value, sheetStyle, logoImage);
    if (!info) continue;
    items.push({ index, label, value, dataUrl: canvas.toDataURL('image/png') });
  }

  return items;
}

export default function BatchSheet({ payload, encoded, style, logoImage }: Props) {
  const [config, setConfig] = useState<SheetConfig>(DEFAULT_SHEET);
  const [items, setItems] = useState<SheetItem[]>([]);
  const [busy, setBusy] = useState(false);

  const defaultTemplate = useMemo(() => defaultSheetTemplate(payload), [payload]);

  // Keep the template in step with the payload, but never clobber an edit.
  useEffect(() => {
    setConfig((previous) =>
      previous.template === '' || previous.template === DEFAULT_SHEET.template
        ? { ...previous, template: defaultTemplate }
        : previous
    );
  }, [defaultTemplate]);

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

  const patch = (next: Partial<SheetConfig>) => setConfig((previous) => ({ ...previous, ...next }));

  const handleDownloadSheet = async () => {
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

  return (
    <div className="sheet-section">
      <div className="sheet-controls">
        <div className="form-group">
          <label className="form-label" htmlFor="sheet-template">
            Numbering template
          </label>
          <input
            id="sheet-template"
            className="form-input mono"
            value={config.template}
            placeholder={defaultTemplate}
            onChange={(e) => patch({ template: e.target.value })}
          />
          <p className="field-hint">
            <code>{'{{n}}'}</code> inserts the number, <code>{'{{label}}'}</code> the label.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="sheet-label">
            Label template
          </label>
          <input
            id="sheet-label"
            className="form-input mono"
            value={config.labelTemplate}
            onChange={(e) => patch({ labelTemplate: e.target.value })}
          />
        </div>

        <div className="sheet-numbers">
          <div className="form-group">
            <label className="form-label" htmlFor="sheet-count">Codes</label>
            <input
              id="sheet-count"
              className="form-input"
              type="number"
              min={1}
              max={MAX_ITEMS}
              value={config.count}
              onChange={(e) => patch({ count: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sheet-start">Starts at</label>
            <input
              id="sheet-start"
              className="form-input"
              type="number"
              min={0}
              value={config.start}
              onChange={(e) => patch({ start: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sheet-columns">Per row</label>
            <input
              id="sheet-columns"
              className="form-input"
              type="number"
              min={1}
              max={12}
              value={config.columns}
              onChange={(e) => patch({ columns: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sheet-size">Code px</label>
            <input
              id="sheet-size"
              className="form-input"
              type="number"
              min={120}
              max={1024}
              step={20}
              value={config.codeSize}
              onChange={(e) => patch({ codeSize: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="sheet-actions">
          <button type="button" className="download-btn primary" disabled={!items.length} onClick={() => window.print()}>
            <Printer size={13} /> Print sheet
          </button>
          <button type="button" className="download-btn" disabled={!items.length} onClick={handleDownloadSheet}>
            <ImageIcon size={13} /> PNG
          </button>
          <button type="button" className="download-btn" disabled={!items.length} onClick={handleDownloadCsv}>
            <FileSpreadsheet size={13} /> CSV
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="sheet-empty">
          {busy ? 'Building sheet…' : 'Enter a URL or text above to generate a numbered sheet.'}
        </div>
      ) : (
        <>
          <div className="sheet-summary">
            {items.length} codes · {items[0].label} → {items[items.length - 1].label} ·{' '}
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