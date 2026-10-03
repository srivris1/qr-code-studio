import { useCallback } from 'react';
import type { QRPayload, QRType, ValidationError } from '../types';
import { validatePayload } from '../utils/validators';
import { Link2, Type, Mail, Phone, Wifi } from 'lucide-react';

interface Props {
  payload: QRPayload;
  onChange: (p: QRPayload) => void;
  errors: ValidationError[];
  onErrorsChange: (e: ValidationError[]) => void;
}

const TYPES: { type: QRType; label: string; icon: typeof Link2 }[] = [
  { type: 'url', label: 'URL', icon: Link2 },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'wifi', label: 'Wi-Fi', icon: Wifi },
];

export default function InputPanel({ payload, onChange, errors, onErrorsChange }: Props) {
  const switchType = useCallback((type: QRType) => {
    const base: QRPayload = { type };
    switch (type) {
      case 'url': base.url = ''; break;
      case 'text': base.text = ''; break;
      case 'email': base.email = { to: '', subject: '', body: '' }; break;
      case 'phone': base.phone = ''; break;
      case 'wifi': base.wifi = { ssid: '', password: '', encryption: 'WPA', hidden: false }; break;
    }
    onChange(base);
    onErrorsChange([]);
  }, [onChange, onErrorsChange]);

  const update = useCallback((patch: Partial<QRPayload>) => {
    const next = { ...payload, ...patch };
    onChange(next);
    onErrorsChange(validatePayload(next));
  }, [payload, onChange, onErrorsChange]);

  const getError = (field: string) => errors.find(e => e.field === field)?.message;

  return (
    <div>
      <div className="section-title">Data type</div>
      <div className="type-tabs">
        {TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            className={`type-tab ${payload.type === type ? 'active' : ''}`}
            onClick={() => switchType(type)}
            id={`tab-${type}`}
          >
            <Icon size={14} className="type-tab-icon" />
            {label}
          </button>
        ))}
      </div>

      <div className="section-title">Content</div>
      {payload.type === 'url' && (
        <div className="form-group">
          <label className="form-label">Website URL</label>
          <input
            className="form-input"
            type="url"
            placeholder="https://example.com"
            value={payload.url || ''}
            onChange={e => update({ url: e.target.value })}
            id="input-url"
          />
          {getError('url') && <div className="form-error">{getError('url')}</div>}
        </div>
      )}

      {payload.type === 'text' && (
        <div className="form-group">
          <label className="form-label">Text content</label>
          <textarea
            className="form-textarea"
            placeholder="Enter any text..."
            value={payload.text || ''}
            onChange={e => update({ text: e.target.value })}
            maxLength={4296}
            id="input-text"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            {getError('text') && <div className="form-error">{getError('text')}</div>}
            <div style={{ fontSize: '0.625rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
              {(payload.text || '').length}/4296
            </div>
          </div>
        </div>
      )}

      {payload.type === 'email' && (
        <>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="hello@example.com"
              value={payload.email?.to || ''}
              onChange={e => update({ email: { ...payload.email!, to: e.target.value, subject: payload.email?.subject || '', body: payload.email?.body || '' } })}
              id="input-email"
            />
            {getError('email.to') && <div className="form-error">{getError('email.to')}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Subject <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
            <input
              className="form-input"
              placeholder="Email subject"
              value={payload.email?.subject || ''}
              onChange={e => update({ email: { ...payload.email!, to: payload.email?.to || '', subject: e.target.value, body: payload.email?.body || '' } })}
              id="input-email-subject"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Body <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
            <textarea
              className="form-textarea"
              placeholder="Email body text..."
              value={payload.email?.body || ''}
              onChange={e => update({ email: { ...payload.email!, to: payload.email?.to || '', subject: payload.email?.subject || '', body: e.target.value } })}
              id="input-email-body"
            />
          </div>
        </>
      )}

      {payload.type === 'phone' && (
        <div className="form-group">
          <label className="form-label">Phone number</label>
          <input
            className="form-input"
            type="tel"
            placeholder="+1 234 567 8900"
            value={payload.phone || ''}
            onChange={e => update({ phone: e.target.value })}
            id="input-phone"
          />
          {getError('phone') && <div className="form-error">{getError('phone')}</div>}
        </div>
      )}

      {payload.type === 'wifi' && (
        <>
          <div className="form-group">
            <label className="form-label">Network name (SSID)</label>
            <input
              className="form-input"
              placeholder="MyNetwork"
              value={payload.wifi?.ssid || ''}
              onChange={e => update({ wifi: { ...payload.wifi!, ssid: e.target.value } })}
              id="input-ssid"
            />
            {getError('wifi.ssid') && <div className="form-error">{getError('wifi.ssid')}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Network password"
              value={payload.wifi?.password || ''}
              onChange={e => update({ wifi: { ...payload.wifi!, password: e.target.value } })}
              id="input-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Encryption</label>
            <select
              className="form-select"
              value={payload.wifi?.encryption || 'WPA'}
              onChange={e => update({ wifi: { ...payload.wifi!, encryption: e.target.value as 'WPA' | 'WEP' | 'nopass' } })}
              id="input-encryption"
            >
              <option value="WPA">WPA / WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">None (Open)</option>
            </select>
          </div>
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={payload.wifi?.hidden || false}
              onChange={e => update({ wifi: { ...payload.wifi!, hidden: e.target.checked } })}
              id="input-hidden"
            />
            Hidden network
          </label>
        </>
      )}
    </div>
  );
}
