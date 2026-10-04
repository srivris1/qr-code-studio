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
  /**
   * Why the read failed, when the failure was something other than "the decoder
   * looked and found no code". A null `decoded` on its own is ambiguous: this is
   * what separates a genuinely unscannable image from a bug in this pipeline.
   */
  error: string | null;
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
  let error: string | null = null;

  // jsQR indexes four bytes at a time and throws on anything else. Say so
  // plainly instead of letting a buffer-shape bug masquerade as a bad code.
  if (data.length !== width * height * 4) {
    error = `decoder expects RGBA (${width * height * 4} bytes) but received ${data.length}`;
  } else {
    try {
      const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
      if (result) {
        decoded = result.data;
        version = result.version;
        ok = expected === null ? true : result.data === expected;
      }
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : 'decoder threw an unknown error';
    }
  }

  scope.postMessage({
    requestId,
    ok,
    decoded,
    version,
    error,
    decodeMs: Math.round(performance.now() - started),
  });
};
