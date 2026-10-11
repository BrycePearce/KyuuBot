import { setTimeout as delay } from 'node:timers/promises';

export interface FetchBufferOptions {
  maxBytes?: number;
  /** Deadline for the entire operation, including body reads and retries. */
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  /** Injectable transport for callers with custom networking or tests. */
  fetch?: typeof globalThis.fetch;
}

export class HttpStatusError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP request failed with status ${status}`);
    this.name = 'HttpStatusError';
  }
}

export class ResponseSizeError extends Error {
  constructor(maxBytes: number) {
    super(`HTTP response exceeds the ${maxBytes}-byte limit`);
    this.name = 'ResponseSizeError';
  }
}

function retryDelay(value: string | null, attempt: number): number {
  if (value !== null) {
    const seconds = Number(value);
    const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
    if (Number.isFinite(milliseconds)) return Math.min(5000, Math.max(0, milliseconds));
  }
  return Math.min(5000, 250 * 2 ** attempt);
}

async function readBounded(response: Response, maxBytes: number): Promise<Buffer> {
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) > maxBytes) {
    await response.body?.cancel();
    throw new ResponseSizeError(maxBytes);
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ResponseSizeError(maxBytes);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
}

/** Download a GET response with bounded memory, retries, and an overall deadline. */
export async function fetchBuffer(url: string, options: FetchBufferOptions = {}): Promise<Buffer> {
  const { maxBytes = 25 * 1024 * 1024, timeoutMs = 30_000, retries = 2, signal } = options;
  for (const [name, value] of Object.entries({ maxBytes, timeoutMs, retries })) {
    if (!Number.isSafeInteger(value) || value < (name === 'retries' ? 0 : 1)) {
      throw new RangeError(`${name} must be a ${name === 'retries' ? 'non-negative' : 'positive'} integer`);
    }
  }
  if (timeoutMs > 2_147_483_647 || retries > 5) throw new RangeError('HTTP timeout or retry count is too large');

  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => {
    const error = new Error(`HTTP request timed out after ${timeoutMs} ms`);
    error.name = 'TimeoutError';
    controller.abort(error);
  }, timeoutMs);
  timeout.unref();

  try {
    for (let attempt = 0; ; attempt++) {
      controller.signal.throwIfAborted();
      let waitMs = retryDelay(null, attempt);
      try {
        const response = await (options.fetch ?? globalThis.fetch)(url, { signal: controller.signal });
        if (!response.ok) {
          waitMs = retryDelay(response.headers.get('retry-after'), attempt);
          await response.body?.cancel();
          throw new HttpStatusError(response.status);
        }
        return await readBounded(response, maxBytes);
      } catch (error) {
        controller.signal.throwIfAborted();
        const transient =
          error instanceof TypeError ||
          (error instanceof HttpStatusError && (error.status === 408 || error.status === 429 || error.status >= 500));
        if (!transient || attempt >= retries) throw error;
        await delay(waitMs, undefined, { signal: controller.signal });
      }
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
