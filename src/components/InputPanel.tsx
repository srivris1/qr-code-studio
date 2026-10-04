import { useCallback } from 'react';
import type { QRPayload, QRType, ValidationError } from '../types';
import { validatePayload, normalizePhone, formatPhone } from '../utils/validators';
import { Link2, Type, Mail, Phone, Wifi, MessageSquare, Check, Info } from 'lucide-react';

interface Props {
  payload: QRPayload;
  onChange: (p: QRPayload) => void;
  errors: ValidationError[];
  onErrorsChange: (e: ValidationError[]) => void;
}

const TYPES: { type: QRType; label: string; icon: typeof Link2 }[] = [
  { type: 'url', label: 'URL', icon: Link2 },
  { type: 'text', label: 'TEXT', icon: Type },
  { type: 'email', label: 'MAIL', icon: Mail },
  { type: 'phone', label: 'CALL', icon: Phone },
  { type: 'sms', label: 'SMS', icon: MessageSquare },
  { type: 'wifi', label: 'WIFI', icon: Wifi },
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
      <div className="section-label">
        <span className="tag">01A</span> payload type
      </div>
      <div className="type-grid">
        {TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            className={`type-btn ${payload.type === type ? 'active' : ''}`}
            onClick={() => switchType(type)}
            id={`tab-${type}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="section-label">
        <span className="tag">01B</span> payload
      </div>

      {payload.type === 'url' && (
        <div className="field">
          <label htmlFor="input-url">Web address</label>
          <input
            id="input-url"
            className="input"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="example.com/pricing"
            value={payload.url || ''}
            onChange={(e) => update({ url: e.target.value })}
          />
          {getError('url') ? (
            <div className="err">! {getError('url')}</div>
          ) : (
            payload.url && (
              <div className="readout-line">
                <Info size={11} />
                <code>
                  {/^[a-z][a-z0-9+.-]*:\/\//i.test(payload.url.trim())
                    ? payload.url.trim()
                    : `https://${payload.url.trim()}`}
                </code>
              </div>
            )
          )}
        </div>
      )}

      {payload.type === 'text' && (
        <div className="field">
          <label htmlFor="input-text">Plain text</label>
          <textarea
            id="input-text"
            className="textarea"
            placeholder="Type anything…"
            value={payload.text || ''}
            onChange={(e) => update({ text: e.target.value })}
          />
          <div className="field-foot">
            {getError('text') && <div className="err">! {getError('text')}</div>}
            <span className="readout-line grow" style={{ marginTop: 0 }}>
              {(payload.text || '').length} chars
            </span>
          </div>
        </div>
      )}

      {payload.type === 'email' && (
        <>
          <div className="field">
            <label htmlFor="input-email">Recipient</label>
            <input
              id="input-email"
              className="input"
              type="email"
              placeholder="hello@example.com"
              value={payload.email?.to || ''}
              onChange={(e) =>
                update({
                  email: {
                    ...payload.email!,
                    to: e.target.value,
                    subject: payload.email?.subject || '',
                    body: payload.email?.body || '',
                  },
                })
              }
            />
            {getError('email.to') && <div className="err">! {getError('email.to')}</div>}
          </div>
          <div className="field">
            <label htmlFor="input-email-subject">
              Subject <span className="opt">// optional</span>
            </label>
            <input
              id="input-email-subject"
              className="input"
              placeholder="Subject line"
              value={payload.email?.subject || ''}
              onChange={(e) =>
                update({
                  email: {
                    ...payload.email!,
                    to: payload.email?.to || '',
                    subject: e.target.value,
                    body: payload.email?.body || '',
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="input-email-body">
              Body <span className="opt">// optional</span>
            </label>
            <textarea
              id="input-email-body"
              className="textarea"
              placeholder="Message body…"
              value={payload.email?.body || ''}
              onChange={(e) =>
                update({
                  email: {
                    ...payload.email!,
                    to: payload.email?.to || '',
                    subject: payload.email?.subject || '',
                    body: e.target.value,
                  },
                })
              }
            />
          </div>
        </>
      )}

      {payload.type === 'phone' && (
        <div className="field">
          <label htmlFor="input-phone">Phone number</label>
          <input
            id="input-phone"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={payload.phone || ''}
            onChange={(e) => update({ phone: e.target.value })}
          />
{getError('phone') ? (
            <div className="err">! {getError('phone')}</div>
          ) : (
            phone.digits && (
              <div className="readout-line ok">
                <Check size={11} />
                <span>
                  dials <code>{formatPhone(phone.dialable)}</code>
                  {!phone.hasPlus ? ' — no country code, so it only dials locally' : ''}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {payload.type === 'sms' && (
        <>
          <div className="field">
            <label htmlFor="input-sms-number">Recipient number</label>
            <input
              id="input-sms-number"
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={payload.sms?.number || ''}
              onChange={(e) => update({ sms: { number: e.target.value, message: payload.sms?.message || '' } })}
            />
            {getError('sms.number') ? (
              <div className="err">! {getError('sms.number')}</div>
            ) : (
              sms.digits && (
                <div className="readout-line ok">
                  <Check size={11} />
                  <span>
                    texts <code>{formatPhone(sms.dialable)}</code>
                    {!sms.hasPlus ? ' — no country code, so it only sends locally' : ''}
                  </span>
                </div>
              )
            )}
          </div>
          <div className="field">
            <label htmlFor="input-sms-message">
              Message <span className="opt">// optional</span>
            </label>
            <textarea
              id="input-sms-message"
              className="textarea"
              placeholder="Pre-filled message…"
              value={payload.sms?.message || ''}
              onChange={(e) => update({ sms: { number: payload.sms?.number || '', message: e.target.value } })}
            />
          </div>
        </>
      )}

      {payload.type === 'wifi' && (
        <>
          <div className="field">
            <label htmlFor="input-ssid">SSID</label>
            <input
              id="input-ssid"
              className="input"
              placeholder="Campus WiFi"
              value={payload.wifi?.ssid || ''}
              onChange={(e) => update({ wifi: { ...payload.wifi!, ssid: e.target.value } })}
            />
            {getError('wifi.ssid') && <div className="err">! {getError('wifi.ssid')}</div>}
          </div>
          <div className="field">
            <label htmlFor="input-password">Passphrase</label>
            <input
              id="input-password"
              className="input"
              type="password"
              placeholder="Network password"
              value={payload.wifi?.password || ''}
              onChange={(e) => update({ wifi: { ...payload.wifi!, password: e.target.value } })}
            />
            {getError('wifi.password') && <div className="err">! {getError('wifi.password')}</div>}
          </div>
          <div className="field">
            <label htmlFor="input-encryption">Security</label>
            <select
              id="input-encryption"
              className="select"
              value={payload.wifi?.encryption || 'WPA'}
              onChange={(e) =>
                update({ wifi: { ...payload.wifi!, encryption: e.target.value as 'WPA' | 'WEP' | 'nopass' } })
              }
            >
              <option value="WPA">WPA / WPA2 / WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">None (open)</option>
            </select>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={payload.wifi?.hidden || false}
              onChange={(e) => update({ wifi: { ...payload.wifi!, hidden: e.target.checked } })}
              id="input-hidden"
            />
            hidden network
          </label>
        </>
      )}
    </div>
  );
}