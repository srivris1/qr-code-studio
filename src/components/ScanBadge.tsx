import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface Props {
  score: number;
  contrastRatio: number;
  hasContent: boolean;
}

export default function ScanBadge({ score, contrastRatio, hasContent }: Props) {
  if (!hasContent) return null;

  const level = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'danger';
  const scoreClass = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const Icon = score >= 70 ? ShieldCheck : score >= 40 ? ShieldAlert : ShieldX;
  const wcagPass = contrastRatio >= 4.5;

  return (
    <div className={`scan-badge ${level}`}>
      <Icon size={18} className="scan-badge-icon" />
      <div className="scan-badge-text">
        <div className="scan-badge-title">
          {score >= 70 ? 'Scan Verified' : score >= 40 ? 'Scan Warning' : 'Scan Risk'}
        </div>
        <div className="scan-badge-detail">
          Contrast {contrastRatio}:1 {wcagPass ? '(WCAG AA ✓)' : '(Below WCAG AA)'}
        </div>
      </div>
      <div className={`scan-score ${scoreClass}`}>{score}%</div>
    </div>
  );
}
