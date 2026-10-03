import { useState } from 'react';
import { ExternalLink, Phone, MessageSquare, Mail, Wifi, Type, Copy, Check, Info } from 'lucide-react';
import type { PayloadAction } from '../utils/actions';
import { copyTextToClipboard } from '../utils/exporters';

interface Props {
  action: PayloadAction;
}

const ICONS = {
  link: ExternalLink,
  call: Phone,
  sms: MessageSquare,
  email: Mail,
  wifi: Wifi,
  text: Type,
} as const;

export default function ActionPreview({ action }: Props) {
  const [copied, setCopied] = useState(false);
  const Icon = ICONS[action.kind];

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(action.detail);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="action-preview">
      <div className="action-preview-header">
        <Icon size={14} />
        <span className="action-preview-headline">{action.headline}</span>
      </div>

      <div className="action-preview-value">{action.value}</div>

      <div className="action-preview-detail">
        <code>{action.detail}</code>
        <button className="action-copy-btn" onClick={handleCopy} title="Copy exact payload">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      {action.hint && (
        <div className="action-preview-hint">
          <Info size={11} />
          <span>{action.hint}</span>
        </div>
      )}

      {action.href && (
        <a className="action-test-btn" href={action.href} target="_blank" rel="noreferrer">
          <Icon size={12} />
          {action.kind === 'call' ? 'Open dialler with this number' : 'Try it now'}
        </a>
      )}
    </div>
  );
}