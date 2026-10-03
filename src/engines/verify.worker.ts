import jsQR from 'jsqr';

export interface VerifyRequest {
  requestId: number;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Exact string we expect back, or null to accept any successful decode. */
  expected: string | null;
}

export interface VerifyResponse {
  requestId: number;
  ok: boolean;
  decoded: string | null;
  decodeMs: number;
  version: number | null;
}

const scope = self as unknown as {
  postMessage: (message: VerifyResponse) => void;
  onmessage: ((event: MessageEvent<VerifyRequest>) => void) | null;
};

scope.onmessage = (event: MessageEvent<VerifyRequest>) => {
  const { requestId, data, width, height, expected } = event.data;
  const started = performance.now();
  let decoded: string | null = null;
  let version: number | null = null;
  let ok = false;

  try {
    const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    if (result) {
      decoded = result.data;
      version = result.version;
      ok = expected === null ? true : result.data === expected;
    }
  } catch {
    ok = false;
  }

  scope.postMessage({
    requestId,
    ok,
    decoded,
    version,
    decodeMs: Math.round(performance.now() - started),
  });
};
