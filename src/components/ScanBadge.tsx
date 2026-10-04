import { ShieldCheck, TriangleAlert, Loader2, ScanLine, Wrench } from 'lucide-react';
import type { VerifyResult } from '../types';
import type { Diagnosis } from '../engines/diagnostics';

interface Props {
  verify: VerifyResult;
  diagnosis: Diagnosis | null;
  onFix: () => void;
  onOpenScanner: () => void;
}

const SEGMENTS = 22;

export default function ScanBadge({ verify, diagnosis, onFix, onOpenScanner }: Props) {
  if (verify.status === 'idle') {
    return (
      <div className="verify idle">
        <div className="verify-mark">
          <ScanLine size={17} />
        </div>
        <div>
          <div className="verify-title">scan check armed</div>
          <div className="verify-sub">
            The rendered pixels get downsampled to camera resolution and read back by a real decoder.
            Nothing is claimed before that succeeds.
          </div>
        </div>
      </div>
    );
  }

  if (verify.status === 'pending') {
    return (
      <div className="verify busy">
        <div className="verify-mark">
          <Loader2 size={17} className="spin" />
        </div>
        <div>
          <div className="verify-title">decoding render</div>
          <div className="verify-sub">sampling at 14px per module · blurring like a camera</div>
          <div className="meter">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const passed = verify.status === 'pass';
  // A pipeline error is not evidence about the code, so it must not be dressed
  // up as "this will not decode".
  const broken = verify.status === 'fail' && !!verify.error;
  const tone = passed ? 'pass' : broken ? 'warn' : diagnosis?.level === 'warn' ? 'warn' : 'fail';
  const Icon = passed ? ShieldCheck : TriangleAlert;
  const title = passed
    ? 'verified · decodes'
    : broken
      ? 'decode check did not run'
      : diagnosis?.level === 'warn'
        ? 'decodes, but fragile'
        : 'will not decode';

  const faults = broken
    ? [verify.error as string]
    : (diagnosis?.issues ?? []).filter((issue) => !issue.startsWith('Decoded successfully'));

  const subtitle = passed
    ? `round-tripped through a decoder in ${verify.decodeMs}ms · v${verify.version} · ${verify.moduleCount}×${verify.moduleCount} modules · payload matched exactly`
    : broken
      ? 'The decoder could not be given a usable image, so this code is untested — not proven bad.'
      : verify.decoded === null
        ? 'no finder pattern was located in the rendered image'
        : `decoder read "${verify.decoded.slice(0, 48)}" instead of the encoded value`;

  return (
    <div className={`verify ${tone}`}>
      <div className="verify-mark">
        <Icon size={17} />
      </div>
      <div>
        <div className="verify-title">
          {title}
          {passed ? (
            <span style={{ letterSpacing: '0.1em', color: 'var(--txt-3)', fontWeight: 400 }}>
              · {verify.decodeMs}ms
            </span>
          ) : null}
        </div>
        <div className="verify-sub">{subtitle}</div>

        <div className="meter">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <i key={i} />
          ))}
        </div>

        {faults.length > 0 && (
          <ul className="faults">
            {faults.slice(0, 3).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}

        <div className="verify-actions">
          <button type="button" className="cmd sm" onClick={onOpenScanner}>
            <ScanLine size={11} /> test with camera
          </button>
          {!passed && (
            <button type="button" className="cmd sm" onClick={onFix}>
              <Wrench size={11} /> apply safe style
            </button>
          )}
        </div>
      </div>
    </div>
  );
}