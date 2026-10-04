import type { TapeLine } from '../types';

interface Props {
  lines: TapeLine[];
}

const TONE_LABEL: Record<TapeLine['tone'], string> = {
  dim: '····',
  ok: ' OK ',
  warn: 'WARN',
  bad: 'FAIL',
};

export default function DecodeTape({ lines }: Props) {
  return (
    <div className="tape">
      <div className="tape-head">
        <span className="cursor" />
        <span>scan.log</span>
      </div>
      <div className="tape-body">
        {lines.length === 0 ? (
          <div className="tape-line">
            <span className="t">····</span>
            <span className="m">awaiting input…</span>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`tape-line ${line.tone}`}>
              <span className="t">{line.at}</span>
              <span className="m">{TONE_LABEL[line.tone]} {line.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}