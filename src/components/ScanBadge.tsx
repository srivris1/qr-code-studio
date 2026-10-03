import { ShieldCheck, ShieldAlert, ShieldX, Loader2, ScanLine, Wand2 } from 'lucide-react';
import type { VerifyResult } from '../types';
import type { Diagnosis } from '../engines/diagnostics';

interface Props {
  verify: VerifyResult;
  diagnosis: Diagnosis | null;
  onFix: () => void;
  onOpenScanner: () => void;
}

export default function ScanBadge({ verify, diagnosis, onFix, onOpenScanner }: Props) {
  if (verify.status === 'idle') {
    return (
      <div className="scan-badge idle">
        <ScanLine size={18} className="scan-badge-icon" />
        <div className="scan-badge-text">
          <div className="scan-badge-title">Scan check</div>
          <div className="scan-badge-detail">A decoder will read the rendered pixels before you download.</div>
        </div>
      </div>
    );
  }

  if (verify.status === 'pending') {
    return (
      <div className="scan-badge idle">
        <Loader2 size={18} className="scan-badge-icon spin" />
        <div className="scan-badge-text">
          <div className="scan-badge-title">Reading the rendered code…</div>
          <div className="scan-badge-detail">Sampling the pixels a scanner would actually see.</div>
        </div>
      </div>
    );
  }

  const passed = verify.status === 'pass';
  const level = passed ? 'success' : diagnosis?.level === 'warn' ? 'warning' : 'danger';
  const Icon = passed ? ShieldCheck : diagnosis?.level === 'warn' ? ShieldAlert : ShieldX;
  const title = passed ? 'Verified — this scans' : diagnosis?.level === 'warn' ? 'Scans, but fragile' : 'This will not scan';

  return (
    <div className={`scan-badge ${level}`}>
      <Icon size={18} className="scan-badge-icon" />
      <div className="scan-badge-text">
        <div className="scan-badge-title">{title}</div>
        <div className="scan-badge-detail">
          {passed
            ? `Round-tripped through a real decoder in ${verify.decodeMs}ms · version ${verify.version} · ${verify.moduleCount}×${verify.moduleCount} modules`
            : verify.decoded === null
              ? 'Nothing could be read from the rendered image.'
              : `Decoder read “${verify.decoded.slice(0, 48)}” instead of the encoded value.`}
        </div>
        {diagnosis && diagnosis.issues.length > 0 && (
          <ul className="scan-issues">
            {diagnosis.issues.slice(0, 3).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
        <div className="scan-badge-actions">
          <button className="scan-badge-btn" onClick={onOpenScanner}>
            <ScanLine size={11} /> Test with camera
          </button>
          {!passed && (
            <button className="scan-badge-btn" onClick={onFix}>
              <Wand2 size={11} /> Apply safe style
            </button>
          )}
        </div>
      </div>
      <div className={`scan-score ${passed ? 'high' : 'low'}`}>{passed ? 'PASS' : 'FAIL'}</div>
    </div>
  );
}