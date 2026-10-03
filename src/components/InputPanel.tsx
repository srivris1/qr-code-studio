import { useCallback } from 'react';
import type { QRPayload, QRType, ValidationError } from '../types';
import { validatePayload, normalizePhone, formatPhone } from '../utils/validators';
import { Link2, Type, Mail, Phone, Wifi, MessageSquare, Check } from 'lucide-react';

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
  { type: 'phone', label: 'Call', icon: Phone },
  { type: 'sms', label: 'SMS', icon: MessageSquare },
  { type: 'wifi', label: 'Wi-Fi', icon: Wifi },
];

function emptyPayload(type: QRType): QRPayload {
  switch (type) {
    case 'url':
      return { type: 'url', url: '' };
    case 'text':
      return { type: 'text', text: '' };
    case 'email':
      return { type: 'email', email: { to: '', subject: '', body: '' } };
    case 'phone':
      return { type: 'phone', phone: '' };
    case 'sms':
      return { type: 'sms', sms: { number: '', message: '' } };
    case 'wifi':
      return { type: 'wifi', wifi: { ssid: '', password: '', encryption: 'WPA', hidden: false } };
    default:
      return { type: 'url', url: '' };
  }
}

export default function InputPanel({ payload, onChange, errors, onErrorsChange }: Props) {
  const switchType = useCallback(
    (type: QRType) => {
      onChange(emptyPayload(type));
      onErrorsChange([]);
    },
    [onChange, onErrorsChange]
  );

  const update = useCallback(
    (patch: Partial<QRPayload>) => {
      const next = { ...payload, ...patch };
      onChange(next);
      onErrorsChange(validatePayload(next));
    },
    [payload, onChange, onErrorsChange]
  );

  const getError = (field: string) => errors.find((e) => e.field === field)?.message;

  const phone = normalizePhone(payload.phone || '');
  const sms = normalizePhone(payload.sms?.number || '');

  return (
    <div>
      <div className="section-title">What should the code do?</div>
      <div className="type-tabs">
        {TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            className={`type-tab ${payload.type === type ? 'active' : ''}`}
            onClick={() => switchType(type)}
            id={`tab-${type}`}
            type="button"
          >
            <Icon size={14} className="type-tab-icon" />
            {label}
          </button>
        ))}
      </div>

      <div className="section-title">Content</div>

      {payload.type === 'url' && (
        <div className="form-group">
          <label className="form-label" htmlFor="input-url">
            Web address
          </label>
          <input
            className="form-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="example.com/pricing"
            value={payload.url || ''}
            onChange={(e) => update({ url: e.target.value })}
            id="input-url"
          />
          {getError('url') ? (
            <div className="form-error">{getError('url')}</div>
          ) : (
            payload.url && (
              <div className="form-note">
                {/^[a-z][a-z0-9+.-]*:\/\//i.test(payload.url.trim())
                  ? payload.url.trim()
                  : `https://${payload.url.trim()}`}
              </div>
            )
          )}
        </div>
      )}

      {payload.type === 'text' && (
        <div className="form-group">
          <label className="form-label" htmlFor="input-text">
            Text content
          </label>
          <textarea
            className="form-textarea"
            placeholder="Type anything…"
            value={payload.text || ''}
            onChange={(e) => update({ text: e.target.value })}
            id="input-text"
          />
          <div className="field-footer">
            {getError('text') && <div className="form-error">{getError('text')}</div>}
            <span className="char-count">{(payload.text || '').length} chars</span>
          </div>
        </div>
      )}

      {payload.type === 'email' && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="input-email">
              Recipient
            </label>
            <input
              className="form-input"
              type="email"
              placeholder="hello@example.com"
              value={payload.email?.to || ''}
              onChange={(e) =>
                update({ email: { ...payload.email!, to: e.target.value, subject: payload.email?.subject || '', body: payload.email?.body || '' } })
              }
              id="input-email"
            />
            {getError('email.to') && <div className="form-error">{getError('email.to')}</div>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-email-subject">
              Subject <span className="form-optional">(optional)</span>
            </label>
            <input
              className="form-input"
              placeholder="Subject line"
              value={payload.email?.subject || ''}
              onChange={(e) =>
                update({ email: { ...payload.email!, to: payload.email?.to || '', subject: e.target.value, body: payload.email?.body || '' } })
              }
              id="input-email-subject"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-email-body">
              Body <span className="form-optional">(optional)</span>
            </label>
            <textarea
              className="form-textarea"
              placeholder="Message body…"
              value={payload.email?.body || ''}
              onChange={(e) =>
                update({ email: { ...payload.email!, to: payload.email?.to || '', subject: payload.email?.subject || '', body: e.target.value } })
              }
              id="input-email-body"
            />
          </div>
        </>
      )}

      {payload.type === 'phone' && (
        <div className="form-group">
          <label className="form-label" htmlFor="input-phone">
            Phone number
          </label>
          <input
            className="form-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={payload.phone || ''}
            onChange={(e) => update({ phone: e.target.value })}
            id="input-phone"
          />
          {getError('phone') ? (
            <div className="form-error">{getError('phone')}</div>
          ) : (
            phone.digits && (
              <div className="form-note ok">
                <Check size={11} />
                <span>
                  Dials <strong>{formatPhone(phone.e164)}</strong>
                  {!phone.hasPlus && ' — add + and your country code to dial internationally'}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {payload.type === 'sms' && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="input-sms-number">
              Recipient number
            </label>
            <input
              className="form-input"
              type="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={payload.sms?.number || ''}
              onChange={(e) =>
                update({ sms: { number: e.target.value, message: payload.sms?.message || '' } })
              }
              id="input-sms-number"
            />
            {getError('sms.number') && <div className="form-error">{getError('sms.number')}</div>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-sms-message">
              Message <span className="form-optional">(optional)</span>
            </label>
            <textarea
              className="form-textarea"
              placeholder="Pre-filled message…"
              value={payload.sms?.message || ''}
              onChange={(e) =>
                update({ sms: { number: payload.sms?.number || '', message: e.target.value } })
              }
              id="input-sms-message"
            />
          </div>
        </>
      )}

      {payload.type === 'wifi' && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="input-ssid">
              Network name (SSID)
            </label>
            <input
              className="form-input"
              placeholder="Campus WiFi"
              value={payload.wifi?.ssid || ''}
              onChange={(e) => update({ wifi: { ...payload.wifi!, ssid: e.target.value } })}
              id="input-ssid"
            />
            {getError('wifi.ssid') && <div className="form-error">{getError('wifi.ssid')}</div>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-password">
              Password
            </label>
            <input
              className="form-input"
              type="password"
              placeholder="Network password"
              value={payload.wifi?.password || ''}
              onChange={(e) => update({ wifi: { ...payload.wifi!, password: e.target.value } })}
              id="input-password"
            />
            {getError('wifi.password') && <div className="form-error">{getError('wifi.password')}</div>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="input-encryption">
              Security
            </label>
            <select
              className="form-select"
              value={payload.wifi?.encryption || 'WPA'}
              onChange={(e) =>
                update({ wifi: { ...payload.wifi!, encryption: e.target.value as 'WPA' | 'WEP' | 'nopass' } })
              }
              id="input-encryption"
            >
              <option value="WPA">WPA / WPA2 / WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">None (open)</option>
            </select>
          </div>
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={payload.wifi?.hidden || false}
              onChange={(e) => update({ wifi: { ...payload.wifi!, hidden: e.target.checked } })}
              id="input-hidden"
            />
            This network is hidden
          </label>
        </>
      )}
    </div>
  );
}