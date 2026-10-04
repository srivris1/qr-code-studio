import type { QRPayload, ValidationError, ErrorCorrectionLevel } from '../types';
import { generateMatrix } from '../engines/qr-renderer';

/**
 * Host matcher that accepts everything a real user pastes into a "website" box:
 * bare domains, sub-domains, IPv4, bracketed IPv6, `localhost:5173`, and
 * anything already carrying a scheme. The old pattern rejected ports and IP
 * addresses outright, which silently produced an empty QR code.
 */
const HOSTNAME = String.raw`(?:[\w-]+\.)+[A-Za-z]{2,}|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-fA-F:]+\]|localhost`;
const PORT = String.raw`(?::\d{1,5})?`;
const PATH = String.raw`(?:[/?#][^\s]*)?`;
const URL_REGEX = new RegExp(String.raw`^(?:[a-z][a-z0-9+.-]*:\/\/)?${HOSTNAME}${PORT}${PATH}$`, 'i');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MAX_PHONE_DIGITS = 15;
export const MIN_PHONE_DIGITS = 3;

export function validatePayload(payload: QRPayload): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (payload.type) {
    case 'url': {
      const url = (payload.url || '').trim();
      if (!url) {
        errors.push({ field: 'url', message: 'URL is required' });
      } else if (!URL_REGEX.test(url)) {
        errors.push({ field: 'url', message: 'That does not look like a web address' });
      } else if (/\s/.test(url)) {
        errors.push({ field: 'url', message: 'URL cannot contain spaces' });
      }
      break;
    }

    case 'text': {
      const text = payload.text || '';
      if (!text.trim()) {
        errors.push({ field: 'text', message: 'Text content is required' });
      } else if (text.length > 2953) {
        errors.push({
          field: 'text',
          message: 'Text exceeds the largest QR code (2953 bytes)',
        });
      }
      break;
    }

    case 'email': {
      const to = (payload.email?.to || '').trim();
      if (!to) {
        errors.push({ field: 'email.to', message: 'Email address is required' });
      } else if (!to.split(/[,;]/).every((part) => EMAIL_REGEX.test(part.trim()))) {
        errors.push({ field: 'email.to', message: 'Please enter valid email addresses' });
      }
      break;
    }

    case 'phone': {
      const { digits, overflow } = normalizePhone(payload.phone || '');
      if (!digits) {
        errors.push({ field: 'phone', message: 'Phone number is required' });
      } else if (overflow) {
        errors.push({
          field: 'phone',
          message: `Numbers cannot exceed ${MAX_PHONE_DIGITS} digits (E.164 limit)`,
        });
      } else if (digits.length < MIN_PHONE_DIGITS) {
        errors.push({ field: 'phone', message: 'That number is too short' });
      }
      break;
    }

    case 'sms': {
      const { digits, overflow } = normalizePhone(payload.sms?.number || '');
      if (!digits) {
        errors.push({ field: 'sms.number', message: 'Recipient number is required' });
      } else if (overflow) {
        errors.push({
          field: 'sms.number',
          message: `Numbers cannot exceed ${MAX_PHONE_DIGITS} digits (E.164 limit)`,
        });
      } else if (digits.length < MIN_PHONE_DIGITS) {
        errors.push({ field: 'sms.number', message: 'That number is too short' });
      }
      break;
    }

    case 'wifi': {
      const w = payload.wifi;
      if (!w?.ssid?.trim()) {
        errors.push({ field: 'wifi.ssid', message: 'Network name (SSID) is required' });
      }
      if (w && w.encryption !== 'nopass' && !w.password) {
        errors.push({ field: 'wifi.password', message: 'Password is required for secured networks' });
      }
      break;
    }
  }

  return errors;
}

export interface NormalizedPhone {
  /** Every digit the user gave us, with the E.164 cap of 15 still applied. */
  digits: string;
  /**
   * True when the user supplied a country code, i.e. a leading `+` or `00`.
   * This is the difference between `tel:+919876543210` and `tel:9876543210`,
   * and the second one is a national number, not a broken international one.
   */
  hasPlus: boolean;
  /** Exactly what goes in front of the digits when encoding. */
  dialable: string;
  /** True when the input carried more than 15 digits. */
  overflow: boolean;
}

/**
 * Reduces anything a human types into a dial string.
 *
 * Scanners hand `tel:` straight to the dialler, and many diallers reject the
 * spaces, dashes, dots and brackets that survive a naive trim — that is what
 * made "scanned fine, then nothing happened". `00` is rewritten to `+`.
 *
 * A `+` is only added when the user actually wrote one. Prefixing every number
 * with `+` turns a 10-digit national number into a call to country code 98,
 * which is worse than the original problem.
 */
export function normalizePhone(input: string): NormalizedPhone {
  const raw = (input || '').trim();
  if (!raw) return { digits: '', hasPlus: false, dialable: '', overflow: false };

  const hasPlus = raw.startsWith('+') || raw.startsWith('00');
  const body = raw.replace(/^\+/, '').replace(/^00/, '');
  const all = body.replace(/\D/g, '');
  const digits = all.slice(0, MAX_PHONE_DIGITS);

  return {
    digits,
    hasPlus,
    dialable: digits && hasPlus ? `+${digits}` : digits,
    overflow: all.length > MAX_PHONE_DIGITS,
  };
}

/** Human-readable rendering of a normalised number, e.g. `+91 98765 43210`. */
export function formatPhone(dialable: string): string {
  if (!dialable) return '';
  const prefix = dialable.startsWith('+') ? '+' : '';
  const rest = prefix ? dialable.slice(1) : dialable;
  if (rest.length <= 4) return `${prefix}${rest}`;
  return `${prefix}${rest.slice(0, rest.length - 4)} ${rest.slice(-4)}`;
}

export function buildQRString(payload: QRPayload): string {
  switch (payload.type) {
    case 'url': {
      const url = (payload.url || '').trim();
      if (!url) return '';
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
      if (/^mailto:|^tel:|^sms:/i.test(url)) return url;
      return `https://${url}`;
    }

    case 'text':
      return (payload.text || '').trim();

    case 'email': {
      const e = payload.email;
      const to = (e?.to || '').trim();
      if (!to) return '';
      const params: string[] = [];
      if (e?.subject) params.push(`subject=${encodeURIComponent(e.subject)}`);
      if (e?.body) params.push(`body=${encodeURIComponent(e.body)}`);
      return params.length ? `mailto:${to}?${params.join('&')}` : `mailto:${to}`;
    }

    case 'phone': {
      const { dialable } = normalizePhone(payload.phone || '');
      return dialable ? `tel:${dialable}` : '';
    }

    case 'sms': {
      const { dialable } = normalizePhone(payload.sms?.number || '');
      if (!dialable) return '';
      const message = payload.sms?.message || '';
      // SMSTO is the form Android and iOS camera apps both understand.
      return message ? `SMSTO:${dialable}:${message}` : `SMSTO:${dialable}`;
    }

    case 'wifi': {
      const w = payload.wifi;
      if (!w?.ssid?.trim()) return '';
      const escape = (s: string) => s.replace(/([\\;,:"'])/g, '\\$1');
      let str = `WIFI:T:${w.encryption};S:${escape(w.ssid.trim())};`;
      if (w.encryption !== 'nopass' && w.password) str += `P:${escape(w.password)};`;
      if (w.hidden) str += 'H:true;';
      str += ';';
      return str;
    }

    default:
      return '';
  }
}

export interface CapacityInfo {
  ok: boolean;
  version: number | null;
  modules: number;
  /** Dark-module budget the chosen error-correction level can recover, in percent. */
  recoveryPercent: number;
  error: string | null;
}

const RECOVERY: Record<ErrorCorrectionLevel, number> = { L: 7, M: 15, Q: 25, H: 30 };

/**
 * Asks the encoder for real. This is exact, unlike a hardcoded character
 * table, and it tells us which QR version the content landed in — which
 * matters because dense versions are the other silent cause of bad scans.
 */
export function checkCapacity(text: string, errorCorrection: ErrorCorrectionLevel): CapacityInfo {
  const recoveryPercent = RECOVERY[errorCorrection];
  if (!text || !text.trim()) {
    return { ok: true, version: null, modules: 0, recoveryPercent, error: null };
  }
  try {
    const matrix = generateMatrix(text, errorCorrection);
    return { ok: true, version: matrix.version, modules: matrix.size, recoveryPercent, error: null };
  } catch {
    return {
      ok: false,
      version: null,
      modules: 0,
      recoveryPercent,
      error: 'This content is larger than a QR code can hold. Shorten it or split it into several codes.',
    };
  }
}

/** Bytes in the payload — the unit that actually decides whether it fits. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function payloadSummary(payload: QRPayload): string {
  switch (payload.type) {
    case 'url':
      return (payload.url || '').trim() || 'No URL';
    case 'text':
      return (payload.text || '').trim().slice(0, 60) || 'No text';
    case 'email':
      return (payload.email?.to || '').trim() || 'No recipient';
    case 'phone': {
      const { dialable } = normalizePhone(payload.phone || '');
      return dialable || 'No number';
    }
    case 'sms': {
      const { dialable } = normalizePhone(payload.sms?.number || '');
      return dialable || 'No number';
    }
    case 'wifi':
      return (payload.wifi?.ssid || '').trim() || 'No network';
    default:
      return '';
  }
}
