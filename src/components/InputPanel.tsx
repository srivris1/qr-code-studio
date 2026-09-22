import { useState, useCallback } from 'react';
import type { QRPayload, QRType, ValidationError } from '../types';
import { validatePayload } from '../utils/validators';
import { Link, Mail, Phone, Type, Wifi } from 'lucide-react';

interface Props {
  payload: QRPayload;
  onChange: (payload: QRPayload) => void;
  errors: ValidationError[];
  onErrorsChange: (errors: ValidationError[]) => void;
}

const TYPE_TABS: { type: QRType; label: string; icon: typeof Link }[] = [
  { type: 'url', label: 'URL', icon: Link },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'wifi', label: 'Wi-Fi', icon: Wifi },
];

export default function InputPanel({ payload, onChange, errors, onErrorsChange }: Props) {
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const switchType = useCallback((type: QRType) => {
    setTouched(new Set());
    onErrorsChange([]);
    const base: QRPayload = { type };
    switch (type) {
      case 'url':
        base.url = '';
        break;
      case 'text':
        base.text = '';
        break;
      case 'email':
        base.email = { to: '', subject: '', body: '' };
        break;
      case 'phone':
        base.phone = '';
        break;
      case 'wifi':
        base.wifi = { ssid: '', password: '', encryption: 'WPA', hidden: false };
        break;
    }
    onChange(base);
  }, [onChange, onErrorsChange]);

  const update = useCallback((updates: Partial<QRPayload>) => {
    const next = { ...payload, ...updates };
    onChange(next);
    const newErrors = validatePayload(next);
    onErrorsChange(newErrors);
  }, [payload, onChange, onErrorsChange]);

  const markTouched = useCallback((field: string) => {
    setTouched(prev => new Set(prev).add(field));
  }, []);

  const getError = (field: string): string | undefined => {
    if (!touched.has(field)) return undefined;
    return errors.find(e => e.field === field)?.message;
  };

  const renderInput = (
    field: string,
    label: string,
    value: string,
    onChangeValue: (v: string) => void,
    placeholder: string,
    type: string = 'text'
  ) => (
    <div className="form-group" key={field}>
      <label className="form-label">{label}</label>
      <input
        id={`input-${field}`}
        className="form-input"
        type={type}
        value={value}
        onChange={e => onChangeValue(e.target.value)}
        onBlur={() => markTouched(field)}
        placeholder={placeholder}
      />
      {getError(field) && <div className="form-error">{getError(field)}</div>}
    </div>
  );

  return (
    <div>
      <div className="section-block">
        <div className="section-title">Data Type</div>
        <div className="type-tabs">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.type}
              id={`tab-${tab.type}`}
              className={`type-tab ${payload.type === tab.type ? 'active' : ''}`}
              onClick={() => switchType(tab.type)}
            >
              <tab.icon size={16} className="type-tab-icon" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="section-block fade-in" key={payload.type}>
        <div className="section-title">Content</div>

        {payload.type === 'url' && renderInput(
          'url', 'Website URL', payload.url || '',
          v => update({ url: v }),
          'https://example.com'
        )}

        {payload.type === 'text' && (
          <div className="form-group">
            <label className="form-label">Text Content</label>
            <textarea
              id="input-text"
              className="form-textarea"
              value={payload.text || ''}
              onChange={e => update({ text: e.target.value })}
              onBlur={() => markTouched('text')}
              placeholder="Enter any text content..."
              rows={4}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {getError('text') && <div className="form-error">{getError('text')}</div>}
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                {(payload.text || '').length} / 4296
              </span>
            </div>
          </div>
        )}

        {payload.type === 'email' && (
          <>
            {renderInput('email.to', 'To Address', payload.email?.to || '',
              v => update({ email: { ...payload.email!, to: v } }),
              'someone@example.com', 'email'
            )}
            {renderInput('email.subject', 'Subject', payload.email?.subject || '',
              v => update({ email: { ...payload.email!, subject: v } }),
              'Meeting tomorrow'
            )}
            <div className="form-group">
              <label className="form-label">Body</label>
              <textarea
                id="input-email-body"
                className="form-textarea"
                value={payload.email?.body || ''}
                onChange={e => update({ email: { ...payload.email!, body: e.target.value } })}
                placeholder="Email body content..."
                rows={3}
              />
            </div>
          </>
        )}

        {payload.type === 'phone' && renderInput(
          'phone', 'Phone Number', payload.phone || '',
          v => update({ phone: v }),
          '+1 234 567 8900', 'tel'
        )}

        {payload.type === 'wifi' && (
          <>
            {renderInput('wifi.ssid', 'Network Name (SSID)', payload.wifi?.ssid || '',
              v => update({ wifi: { ...payload.wifi!, ssid: v } }),
              'MyWiFiNetwork'
            )}
            <div className="form-group">
              <label className="form-label">Security</label>
              <select
                id="input-wifi-encryption"
                className="form-select"
                value={payload.wifi?.encryption || 'WPA'}
                onChange={e => update({ wifi: { ...payload.wifi!, encryption: e.target.value as 'WPA' | 'WEP' | 'nopass' } })}
              >
                <option value="WPA">WPA / WPA2 / WPA3</option>
                <option value="WEP">WEP</option>
                <option value="nopass">No Password</option>
              </select>
            </div>
            {payload.wifi?.encryption !== 'nopass' && renderInput(
              'wifi.password', 'Password', payload.wifi?.password || '',
              v => update({ wifi: { ...payload.wifi!, password: v } }),
              'Enter network password', 'password'
            )}
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={payload.wifi?.hidden || false}
                onChange={e => update({ wifi: { ...payload.wifi!, hidden: e.target.checked } })}
              />
              Hidden network
            </label>
          </>
        )}
      </div>
    </div>
  );
}
