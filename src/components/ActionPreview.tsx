import { useState } from 'react';
import { ExternalLink, Phone, MessageSquare, Mail, Wifi, Type, Copy, Check, Info, Play } from 'lucide-react';
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
    if (!(await copyTextToClipboard(action.detail))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const cta =
    action.kind === 'call'
      ? 'open dialler'
      : action.kind === 'sms'
        ? 'open messages'
        : action.kind === 'email'
          ? 'open mail client'
          : action.kind === 'link'
            ? 'open link now'
            : '';

  return (
    <div className="inspect">
      <div className="inspect-head">
        <Icon size={12} />
        {action.headline}
      </div>

      <div className="inspect-value">{action.value || '—'}</div>

      <div className="inspect-raw">
        <code>{action.detail}</code>
        <button type="button" className="copy-btn" onClick={handleCopy} title="Copy the exact payload">
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>

      {action.hint && (
        <div className="inspect-note">
          <Info size={11} />
          <span>{action.hint}</span>
        </div>
      )}

      {action.href && (
        <div className="inspect-foot">
          <a className="cmd" href={action.href} target="_blank" rel="noreferrer">
            <Play size={11} /> {cta}
          </a>
        </div>
      )}
    </div>
  );
}