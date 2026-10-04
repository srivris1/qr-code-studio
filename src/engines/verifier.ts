import type { VerifyResponse } from './verify.worker';

const TIMEOUT_MS = 6000;
const RGBA = 'decoder expects RGBA (width * height * 4 bytes)';

let worker: Worker | null = null;
let workerBroken = false;
let nextRequestId = 1;
const pending = new Map<
  number,
  { resolve: (response: VerifyResponse) => void; timer: ReturnType<typeof setTimeout> }
>();

function failed(requestId: number, error: string): VerifyResponse {
  return { requestId, ok: false, decoded: null, decodeMs: 0, version: null, error };
}

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./verify.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<VerifyResponse>) => {
      const entry = pending.get(event.data.requestId);
      if (!entry) return;
      pending.delete(event.data.requestId);
      clearTimeout(entry.timer);
      entry.resolve(event.data);
    };
    worker.onerror = () => {
      workerBroken = true;
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
        entry.resolve(failed(0, 'the decode worker failed to start'));
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

/** Falls back to the main thread if workers are unavailable (e.g. locked-down CSP). */
async function verifyInline(
  requestId: number,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  expected: string | null
): Promise<VerifyResponse> {
  const started = performance.now();
  if (data.length !== width * height * 4) {
    return failed(requestId, `${RGBA} but received ${data.length}`);
  }
  try {
    const { default: jsQR } = await import('jsqr');
    const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    return {
      requestId,
      ok: !!result && (expected === null ? true : result.data === expected),
      decoded: result ? result.data : null,
      version: result ? result.version : null,
      decodeMs: Math.round(performance.now() - started),
      error: null,
    };
  } catch (thrown) {
    return failed(requestId, thrown instanceof Error ? thrown.message : 'decoder threw an unknown error');
  }
}

export function decodePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  expected: string | null
): Promise<VerifyResponse> {
  const requestId = nextRequestId++;
  const instance = getWorker();

  if (!instance) {
    return verifyInline(requestId, data, width, height, expected);
  }

  return new Promise<VerifyResponse>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve(failed(requestId, 'the decode worker did not answer in time'));
    }, TIMEOUT_MS);
    pending.set(requestId, { resolve, timer });
    instance.postMessage(
      { requestId, data, width, height, expected },
      [data.buffer as ArrayBuffer]
    );
  });
}

export interface DecodedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Box-downsamples an RGBA image to a fixed number of pixels per module.
 *
 * Averaging every block of source pixels is the point: it reproduces the blur a
 * phone camera adds, so a code that only survives as a crisp screenshot still
 * fails here. A module size of 14px keeps ~16 luminance samples per module,
 * enough for the decoder to see intra-module structure such as gradient falloff
 * and a logo knocking out part of a module.
 *
 * The output is RGBA, not greyscale. jsQR indexes the buffer four bytes at a
 * time and rejects anything that is not exactly `width * height * 4` long with
 * "Malformed data passed to binarizer" — a greyscale buffer here means no code
 * ever verifies, and the failure is invisible because the decoder is handed a
 * null result rather than an error.
 */
export function downsampleRgba(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  totalModules: number,
  pixelsPerModule = 14
): DecodedImage | null {
  if (totalModules <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return null;
  if (source.length < sourceWidth * sourceHeight * 4) return null;

  const width = totalModules * pixelsPerModule;
  const height = width;
  const out = new Uint8ClampedArray(width * height * 4);

  for (let ty = 0; ty < height; ty++) {
    const y0 = Math.floor((ty * sourceHeight) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * sourceHeight) / height));
    for (let tx = 0; tx < width; tx++) {
      const x0 = Math.floor((tx * sourceWidth) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * sourceWidth) / width));

      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        let idx = (y * sourceWidth + x0) * 4;
        for (let x = x0; x < x1; x++, idx += 4) {
          // Rec. 601 luma, which is close enough for a binarisation check.
          sum += source[idx] * 0.299 + source[idx + 1] * 0.587 + source[idx + 2] * 0.114;
          count++;
        }
      }
      // Flat light areas must stay fully light: clamping at 250 leaves a little
      // headroom so antialiased fringes do not drag a whole module dark.
      const luma = count > 0 ? sum / count : 255;
      const v = luma > 250 ? 255 : luma;
      const di = (ty * width + tx) * 4;
      out[di] = v;
      out[di + 1] = v;
      out[di + 2] = v;
      out[di + 3] = 255;
    }
  }

  return { data: out, width, height };
}

/** Reads a rendered canvas and hands back a decoder-shaped, downsampled frame. */
export function sampleModules(
  source: HTMLCanvasElement,
  totalModules: number,
  pixelsPerModule = 14
): DecodedImage | null {
  if (totalModules <= 0) return null;
  const src = source.getContext('2d', { willReadFrequently: true });
  if (!src || source.width === 0 || source.height === 0) return null;

  const pixels = src.getImageData(0, 0, source.width, source.height);
  return downsampleRgba(pixels.data, pixels.width, pixels.height, totalModules, pixelsPerModule);
}
