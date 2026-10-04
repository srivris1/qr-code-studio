/**
 * Round-trip regression check.
 *
 * Renders every payload type through the real renderer into a software canvas,
 * pushes the pixels through the real sampler, and reads them back with the same
 * jsQR build the app ships. If a code cannot survive that, it cannot survive a
 * camera either.
 *
 * Run with `npm run check`.
 */

import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { renderQR, generateMatrix } from '../src/engines/qr-renderer';
import { sampleModules, decodePixels } from '../src/engines/verifier';
import { buildQRString, normalizePhone, formatPhone, validatePayload } from '../src/utils/validators';
import { describePayload } from '../src/utils/actions';
import { DEFAULT_STYLE } from '../src/utils/storage';
import type { QRStyle, QRPayload, DotStyle, FinderShape, ErrorCorrectionLevel } from '../src/types';
import { ShimCanvas } from './canvas-shim';

let passed = 0;
const failures: string[] = [];
const pending: Promise<void>[] = [];

function check(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).then === 'function') {
      pending.push(
        (result as Promise<void>).then(
          () => {
            passed++;
          },
          (error: Error) => {
            failures.push(`${name}: ${error.message}`);
          }
        )
      );
      return;
    }
    passed++;
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`);
  }
}

interface RoundTrip {
  text: string;
  info: NonNullable<ReturnType<typeof renderQR>>;
}

/** Render -> sample -> decode, exactly as the app does it. */
function roundTrip(text: string, style: QRStyle, pixelsPerModule = 14): RoundTrip | null {
  const canvas = new ShimCanvas() as unknown as HTMLCanvasElement;
  const info = renderQR(canvas, text, style);
  if (!info) return null;
  const sampled = sampleModules(canvas, info.totalModules, pixelsPerModule);
  if (!sampled) return null;
  const result = jsQR(sampled.data, sampled.width, sampled.height, { inversionAttempts: 'attemptBoth' });
  return { text: result ? result.data : '', info };
}

// ---------------------------------------------------------------- sampler shape

check('sampler emits an RGBA buffer of exactly width * height * 4 bytes', () => {
  const canvas = new ShimCanvas() as unknown as HTMLCanvasElement;
  const info = renderQR(canvas, 'https://example.com', { ...DEFAULT_STYLE, size: 512 })!;
  const sampled = sampleModules(canvas, info.totalModules)!;
  assert.ok(sampled, 'sampler returned nothing');
  assert.equal(
    sampled.data.length,
    sampled.width * sampled.height * 4,
    `sampler returned ${sampled.data.length} bytes for a ${sampled.width}x${sampled.height} image; ` +
      'jsQR reads RGBA and throws "Malformed data passed to binarizer" on anything else'
  );
  // Alpha must be opaque, or a transparent pixel reads as black to some decoders.
  for (let i = 3; i < sampled.data.length; i += 4) {
    assert.equal(sampled.data[i], 255, `pixel ${i / 4} has alpha ${sampled.data[i]}`);
  }
});

check('sampler downsamples to a square image at the requested module pitch', () => {
  const canvas = new ShimCanvas() as unknown as HTMLCanvasElement;
  const info = renderQR(canvas, 'https://example.com', { ...DEFAULT_STYLE, size: 512 })!;
  const sampled = sampleModules(canvas, info.totalModules, 10)!;
  assert.equal(sampled.width, info.totalModules * 10);
  assert.equal(sampled.height, info.totalModules * 10);
});

// ---------------------------------------------------------------- payload battery

const PAYLOADS: { name: string; payload: QRPayload }[] = [
  { name: 'url bare domain', payload: { type: 'url', url: 'example.com/pricing' } },
  { name: 'url with scheme and query', payload: { type: 'url', url: 'https://example.com/a?b=1&c=2#x' } },
  { name: 'url with port', payload: { type: 'url', url: 'localhost:5173' } },
  { name: 'text', payload: { type: 'text', text: 'Table 12 — booth scan' } },
  { name: 'email', payload: { type: 'email', email: { to: 'hello@example.com', subject: 'Hi', body: 'There' } } },
  { name: 'phone international', payload: { type: 'phone', phone: '+91 98765 43210' } },
  { name: 'sms', payload: { type: 'sms', sms: { number: '+91 98765 43210', message: 'Hi there' } } },
  { name: 'wifi', payload: { type: 'wifi', wifi: { ssid: 'Campus WiFi', password: 'p@ss;word', encryption: 'WPA', hidden: true } } },
];

for (const { name, payload } of PAYLOADS) {
  check(`round-trips: ${name}`, () => {
    const text = buildQRString(payload);
    assert.ok(text, 'buildQRString produced nothing');
    const result = roundTrip(text, { ...DEFAULT_STYLE, size: 512, errorCorrection: 'M', margin: 4 });
    assert.ok(result, 'render produced nothing');
    assert.equal(result.text, text, 'decoder read back a different string');
  });
}

check('a phone number survives the full trip as a dialable tel: URI', () => {
  const payload: QRPayload = { type: 'phone', phone: '+91 98765 43210' };
  const text = buildQRString(payload);
  assert.equal(text, 'tel:+919876543210');
  assert.equal(validatePayload(payload).length, 0);
  assert.equal(describePayload(payload, text).value, '+91987654 3210');
  assert.equal(roundTrip(text, { ...DEFAULT_STYLE, size: 512 })!.text, text);
});

// ---------------------------------------------------------------- style matrix

const DOT_STYLES: DotStyle[] = ['square', 'rounded', 'circle', 'diamond', 'star', 'connected'];
const FINDER_SHAPES: FinderShape[] = ['square', 'rounded', 'circle'];
const LEVELS: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

check('every dot style, finder shape and EC level still decodes', () => {
  const text = 'https://example.com/verify';
  const broken: string[] = [];
  for (const dotStyle of DOT_STYLES) {
    for (const finderShape of FINDER_SHAPES) {
      for (const errorCorrection of LEVELS) {
        const style: QRStyle = { ...DEFAULT_STYLE, size: 512, dotStyle, finderShape, errorCorrection, margin: 4 };
        const result = roundTrip(text, style);
        if (!result || result.text !== text) {
          broken.push(`${dotStyle}/${finderShape}/${errorCorrection}`);
        }
      }
    }
  }
  assert.equal(broken.length, 0, `failed to decode: ${broken.join(', ')}`);
});

check('light-on-dark and gradient fills still decode', () => {
  const text = 'https://example.com/theme';
  const styles: QRStyle[] = [
    { ...DEFAULT_STYLE, size: 512, fgColor: '#0b1220', bgColor: '#f8fafc', margin: 4 },
    { ...DEFAULT_STYLE, size: 512, fgColor: '#ffffff', bgColor: '#000000', margin: 4 },
    {
      ...DEFAULT_STYLE,
      size: 512,
      bgColor: '#0b1220',
      gradientType: 'linear',
      gradientColor1: '#e2e8f0',
      gradientColor2: '#94a3b8',
      margin: 4,
    },
  ];
  for (const style of styles) {
    const result = roundTrip(text, { ...style, errorCorrection: 'H' });
    assert.ok(result && result.text === text, `style ${JSON.stringify(style.fgColor)}/${style.bgColor}/${style.gradientType} failed`);
  }
});

check('survives a coarser camera sampling pitch', () => {
  const text = 'https://example.com/coarse';
  for (const pitch of [14, 10, 8, 6]) {
    const result = roundTrip(text, { ...DEFAULT_STYLE, size: 512, margin: 4 }, pitch);
    assert.ok(result && result.text === text, `failed at ${pitch}px per module`);
  }
});

check('a version 10 dense code decodes at the default size', () => {
  const text = 'https://example.com/' + 'dense-segment/'.repeat(20);
  const matrix = generateMatrix(text, 'M');
  assert.ok(matrix.version >= 10, `expected a dense code, got v${matrix.version}`);
  const result = roundTrip(text, { ...DEFAULT_STYLE, size: 512, margin: 4 });
  assert.ok(result && result.text === text, 'dense code did not decode');
});

// ---------------------------------------------------------------- app entry point

check('decodePixels reads a real render back to the exact payload', async () => {
  // decodePixels is the function the app actually calls, including the worker
  // plumbing and the main-thread fallback.
  const text = 'tel:+919876543210';
  const canvas = new ShimCanvas() as unknown as HTMLCanvasElement;
  const info = renderQR(canvas, text, { ...DEFAULT_STYLE, size: 512 })!;
  const sampled = sampleModules(canvas, info.totalModules)!;

  const response = await decodePixels(sampled.data, sampled.width, sampled.height, text);
  assert.equal(response.decoded, text);
  assert.equal(response.ok, true);
  assert.equal(response.error, null);
  assert.ok(response.version && response.version > 0, 'decoder did not report a version');
});

check('decodePixels explains a malformed buffer instead of returning null', async () => {
  const response = await decodePixels(new Uint8ClampedArray(16 * 16), 16, 16, 'anything');
  assert.equal(response.ok, false);
  assert.equal(response.decoded, null);
  assert.match(response.error ?? '', /RGBA/, 'a buffer-shape bug must not look like a bad code');
});

// ---------------------------------------------------------------- phone rules

check('phone: an international number keeps its country code', () => {
  assert.equal(normalizePhone('+91 98765 43210').digits, '919876543210');
  assert.equal(normalizePhone('+91 98765 43210').dialable, '+919876543210');
  assert.equal(formatPhone('+919876543210'), '+91987654 3210');
});

check('phone: a bare local number is not given a fake country code', () => {
  const local = normalizePhone('9876543210');
  assert.equal(local.hasPlus, false);
  assert.equal(local.dialable, '9876543210', 'a local number must not be prefixed with +');
  assert.equal(buildQRString({ type: 'phone', phone: '9876543210' }), 'tel:9876543210');
  const action = describePayload({ type: 'phone', phone: '9876543210' }, 'tel:9876543210');
  assert.match(action.hint ?? '', /country code/i, 'hint must still ask for a country code');
});

check('phone: 00 is rewritten to the international form', () => {
  assert.equal(normalizePhone('0091 98765 43210').dialable, '+919876543210');
});

check('phone: punctuation is stripped', () => {
  assert.equal(normalizePhone('+1 (234) 567-8900').dialable, '+12345678900');
  assert.equal(normalizePhone('+91-98765-43210').dialable, '+919876543210');
});

check('phone: an over-long number is reported, not silently truncated', () => {
  const payload: QRPayload = { type: 'phone', phone: '+1234567890123456789' };
  const errors = validatePayload(payload);
  assert.equal(errors.length, 1, 'expected exactly one validation error');
  assert.match(errors[0].message, /15 digits/);
  assert.equal(errors[0].field, 'phone');
  assert.equal(validatePayload({ type: 'phone', phone: '12' })[0]?.message, 'That number is too short');
  assert.equal(validatePayload({ type: 'phone', phone: '' })[0]?.message, 'Phone number is required');
  assert.equal(validatePayload({ type: 'phone', phone: '+123456789012345' }).length, 0, '15 digits must pass');
  assert.equal(
    validatePayload({ type: 'phone', phone: '+1234567890123456' })[0]?.message,
    'Numbers cannot exceed 15 digits (E.164 limit)',
    '16 digits must be rejected'
  );
});

check('sms: the recipient is normalised the same way as a call', () => {
  assert.equal(
    buildQRString({ type: 'sms', sms: { number: '98765 43210', message: 'Hi' } }),
    'SMSTO:9876543210:Hi'
  );
  assert.equal(
    buildQRString({ type: 'sms', sms: { number: '+91 98765 43210', message: '' } }),
    'SMSTO:+919876543210'
  );
});

// ---------------------------------------------------------------- report

async function report(): Promise<void> {
  await Promise.all(pending);
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed, ${passed} passed:\n`);
    for (const failure of failures) console.error(`  x ${failure}`);
    process.exit(1);
  }
  console.log(`round-trip check: ${passed} passed`);
}

void report();
