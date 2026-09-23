import { Shield, ShieldAlert, ShieldX } from 'lucide-react';

interface Props {
  score: number;
  contrastRatio: number;
  hasContent: boolean;
}

export default function ScanBadge({ score, contrastRatio, hasContent }: Props) {
  if (!hasContent) return null;

  const level = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';
  const Icon = level === 'success' ? Shield : level === 'warning' ? ShieldAlert : ShieldX;
  const label = level === 'success' ? 'Scan Verified' : level === 'warning' ? 'Scan Warning' : 'Scan Risk';
  const detail = `Contrast ratio: ${contrastRatio.toFixed(1)}:1 ${contrastRatio >= 4.5 ? '(WCAG AA ✓)' : '(Below WCAG AA)'}`;

  return (
    <div className={`scan-badge ${level}`} id="scan-badge">
      <Icon size={22} className="scan-badge-icon" />
      <div className="scan-badge-text">
        <div className="scan-badge-title">{label}</div>
        <div className="scan-badge-detail">{detail}</div>
      </div>
      <div className={`scan-score ${score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'}`}>
        {score}%
      </div>
    </div>
  );
}
