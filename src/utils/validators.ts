import type { QRPayload, ValidationError } from '../types';

const URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-./?%&=+#]*)?$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

export function validatePayload(payload: QRPayload): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (payload.type) {
    case 'url':
      if (!payload.url || payload.url.trim().length === 0) {
        errors.push({ field: 'url', message: 'URL is required' });
      } else if (!URL_REGEX.test(payload.url.trim())) {
        errors.push({ field: 'url', message: 'Please enter a valid URL' });
      }
      break;

    case 'text':
      if (!payload.text || payload.text.trim().length === 0) {
        errors.push({ field: 'text', message: 'Text content is required' });
      } else if (payload.text.length > 4296) {
        errors.push({ field: 'text', message: 'Text exceeds maximum QR capacity (4296 chars)' });
      }
      break;

    case 'email':
      if (!payload.email?.to || payload.email.to.trim().length === 0) {
        errors.push({ field: 'email.to', message: 'Email address is required' });
      } else if (!EMAIL_REGEX.test(payload.email.to.trim())) {
        errors.push({ field: 'email.to', message: 'Please enter a valid email address' });
      }
      break;

    case 'phone':
      if (!payload.phone || payload.phone.trim().length === 0) {
        errors.push({ field: 'phone', message: 'Phone number is required' });
      } else if (!PHONE_REGEX.test(payload.phone.trim())) {
        errors.push({ field: 'phone', message: 'Please enter a valid phone number' });
      }
      break;

    case 'wifi':
      if (!payload.wifi?.ssid || payload.wifi.ssid.trim().length === 0) {
        errors.push({ field: 'wifi.ssid', message: 'Network name (SSID) is required' });
      }
      if (payload.wifi?.encryption !== 'nopass' && (!payload.wifi?.password || payload.wifi.password.length === 0)) {
        errors.push({ field: 'wifi.password', message: 'Password is required for secured networks' });
      }
      break;
  }

  return errors;
}

export function buildQRString(payload: QRPayload): string {
  switch (payload.type) {
    case 'url': {
      const url = payload.url?.trim() || '';
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
      }
      return url;
    }

    case 'text':
      return payload.text?.trim() || '';

    case 'email': {
      const e = payload.email;
      if (!e?.to) return '';
      let mailto = `mailto:${e.to.trim()}`;
      const params: string[] = [];
      if (e.subject) params.push(`subject=${encodeURIComponent(e.subject)}`);
      if (e.body) params.push(`body=${encodeURIComponent(e.body)}`);
      if (params.length > 0) mailto += `?${params.join('&')}`;
      return mailto;
    }

    case 'phone':
      return `tel:${payload.phone?.trim().replace(/\s/g, '') || ''}`;

    case 'wifi': {
      const w = payload.wifi;
      if (!w?.ssid) return '';
      const escape = (s: string) => s.replace(/([\\;,:"'])/g, '\\$1');
      let str = `WIFI:T:${w.encryption};S:${escape(w.ssid)};`;
      if (w.encryption !== 'nopass' && w.password) {
        str += `P:${escape(w.password)};`;
      }
      if (w.hidden) str += 'H:true;';
      str += ';';
      return str;
    }

    default:
      return '';
  }
}
