import type { VerifyResponse } from './verify.worker';

const TIMEOUT_MS = 6000;

let worker: Worker | null = null;
let workerBroken = false;
let nextRequestId = 1;
const pending = new Map<
  number,
  { resolve: (response: VerifyResponse) => void; timer: ReturnType<typeof setTimeout> }
>();

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
        entry.resolve({ requestId: 0, ok: false, decoded: null, decodeMs: 0, version: null });
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
  try {
    const { default: jsQR } = await import('jsqr');
    const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    return {
      requestId,
      ok: !!result && (expected === null ? true : result.data === expected),
      decoded: result ? result.data : null,
      version: result ? result.version : null,
      decodeMs: Math.round(performance.now() - started),
    };
  } catch {
    return { requestId, ok: false, decoded: null, decodeMs: 0, version: null };
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
      resolve({ requestId, ok: false, decoded: null, decodeMs: 0, version: null });
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
 * Box-downsamples a rendered QR to a fixed number of pixels per module.
 *
 * Averaging every block of source pixels is the point: it reproduces the blur a
 * phone camera adds, so a code that only survives as a crisp screenshot still
 * fails here. A module size of 14px keeps ~16 luminance samples per module,
 * enough for the decoder to see intra-module structure such as gradient falloff
 * and a logo knocking out part of a module.
 */
export function sampleModules(
  source: HTMLCanvasElement,
  totalModules: number,
  pixelsPerModule = 14
): DecodedImage | null {
  if (totalModules <= 0) return null;
  const src = source.getContext('2d', { willReadFrequently: true });
  if (!src || source.width === 0) return null;

  const srcData = src.getImageData(0, 0, source.width, source.height).data;
  const srcWidth = source.width;
  const srcHeight = source.height;

  const width = totalModules * pixelsPerModule;
  const height = width;
  const out = new Uint8ClampedArray(width * height);

  for (let ty = 0; ty < height; ty++) {
    const y0 = Math.floor((ty * srcHeight) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * srcHeight) / height));
    for (let tx = 0; tx < width; tx++) {
      const x0 = Math.floor((tx * srcWidth) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * srcWidth) / width));

      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        let idx = (y * srcWidth + x0) * 4;
        for (let x = x0; x < x1; x++, idx += 4) {
          // Rec. 601 luma, which is close enough for a binarisation check.
          sum += srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114;
          count++;
        }
      }
      const luma = count > 0 ? sum / count : 255;
      // Darken slightly so antialiased light shapes still register as light.
      out[ty * width + tx] = luma > 250 ? 255 : luma;
    }
  }

  return { data: out, width, height };
}
