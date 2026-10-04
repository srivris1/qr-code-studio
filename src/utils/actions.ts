import type { QRPayload } from '../types';
import { buildQRString, normalizePhone, formatPhone } from './validators';

export type ActionKind = 'link' | 'call' | 'sms' | 'email' | 'wifi' | 'text';

export interface PayloadAction {
  kind: ActionKind;
  /** What a scanner will do, in plain words. */
  headline: string;
  /** Exactly what will be handed to the phone. */
  detail: string;
  /** Clickable target, when there is one. */
  href: string | null;
  /** The normalised value, e.g. an E.164 number. */
  value: string;
  hint: string | null;
}

const KIND_ICON: Record<ActionKind, string> = {
  link: 'link',
  call: 'phone',
  sms: 'message',
  email: 'mail',
  wifi: 'wifi',
  text: 'text',
};

export function actionIcon(kind: ActionKind): string {
  return KIND_ICON[kind];
}

/**
 * Turns an encoded QR string into the concrete thing a phone will do with it.
 *
 * This panel exists because "the QR scans but nothing happens" is almost always
 * a payload problem, not a picture problem. Showing the exact final string
 * removes the guesswork.
 */
export function describePayload(payload: QRPayload, encoded: string): PayloadAction {
  if (!encoded) {
    return {
      kind: 'text',
      headline: 'Nothing to encode yet',
      detail: '—',
      href: null,
      value: '',
      hint: 'Fill in a field to see what a scanner will receive.',
    };
  }

  switch (payload.type) {
    case 'url': {
      const href = encoded;
      let host = href;
      try {
        host = new URL(href).host;
      } catch {
        host = href;
      }
      return {
        kind: 'link',
        headline: 'Opens a web page',
        detail: href,
        href,
        value: host,
        hint: 'Test the link opens before you print it.',
      };
    }

    case 'phone': {
      const number = encoded.replace(/^tel:/i, '');
      // Ask about the user's input, not about the encoded string: `tel:` numbers
      // start with `+` whenever a country code was given and never otherwise,
      // so testing the encoded value tells you nothing.
      const { hasPlus } = normalizePhone(payload.phone || number);
      return {
        kind: 'call',
        headline: 'Starts a phone call',
        detail: `tel:${number}`,
        href: `tel:${number}`,
        value: formatPhone(number),
        hint: hasPlus
          ? 'Country code included, so this dials from anywhere.'
          : 'No country code. Add + and your country code for international use.',
      };
    }

    case 'sms': {
      const body = encoded.replace(/^SMSTO:/i, '');
      const [number, ...rest] = body.split(':');
      const message = rest.join(':');
      return {
        kind: 'sms',
        headline: 'Opens a text message',
        detail: encoded,
        href: null,
        value: formatPhone(number),
        hint: message ? `Pre-filled message: “${message}”` : 'No pre-filled message.',
      };
    }

    case 'email': {
      const subject = payload.email?.subject || '';
      return {
        kind: 'email',
        headline: 'Opens a new email',
        detail: encoded,
        href: encoded,
        value: payload.email?.to || '',
        hint: subject ? `Subject: ${subject}` : null,
      };
    }

    case 'wifi': {
      const ssid = payload.wifi?.ssid || '';
      return {
        kind: 'wifi',
        headline: 'Offers to join a Wi-Fi network',
        detail: encoded,
        href: null,
        value: ssid,
        hint:
          payload.wifi?.encryption === 'nopass'
            ? 'Open network, no password required.'
            : 'Password is embedded. Anyone who scans can join this network.',
      };
    }

    default:
      return {
        kind: 'text',
        headline: 'Shows plain text',
        detail: encoded,
        href: null,
        value: encoded.length > 80 ? `${encoded.slice(0, 80)}…` : encoded,
        hint: null,
      };
  }
}

/** Numbering template default so the sheet works without any setup. */
export function defaultSheetTemplate(payload: QRPayload): string {
  const encoded = buildQRString(payload);
  if (!encoded) return '{{n}}';
  if (payload.type === 'url') {
    if (/([?&])ref=[^&#]*/.test(encoded)) {
      return encoded.replace(/([?&])ref=[^&#]*/, '$1ref={{n}}');
    }
    return `${encoded}${encoded.includes('?') ? '&' : '?'}ref={{n}}`;
  }
  return `${encoded} {{n}}`;
}

export function applySheetTemplate(template: string, index: number, label: string): string {
  return template.replace(/\{\{\s*label\s*\}\}/g, label).replace(/\{\{\s*n\s*\}\}/g, String(index));
}
