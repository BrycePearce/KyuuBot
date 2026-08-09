/**
 * Retry helper for flaky external calls (model APIs, image generation).
 *
 * Model responses are sampled, so a malformed one is often fixed by simply
 * asking again. Transient HTTP failures are the same story. Anything the
 * caller knows is permanent should be wrapped in NonRetryableError so we fail
 * fast instead of burning attempts on an answer that will not change.
 */

export class NonRetryableError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NonRetryableError';
    this.cause = cause;
  }
}

export type RetryOptions = {
  /** Total attempts including the first. Defaults to 3. */
  attempts?: number;
  /** Delay before the second attempt; doubles each time. Defaults to 500ms. */
  baseDelayMs?: number;
  /** Upper bound on any single delay. Defaults to 8000ms. */
  maxDelayMs?: number;
  onRetry?: (error: unknown, nextAttempt: number) => void;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 500, maxDelayMs = 8000, onRetry, sleep = defaultSleep } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      if (error instanceof NonRetryableError) throw error;
      if (!isRetryableError(error)) throw error;
      if (attempt === attempts) break;

      onRetry?.(error, attempt + 1);
      await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs));
    }
  }

  throw lastError;
}

/**
 * Retry rate limits, server errors, and transport failures. A 4xx other than
 * 429 means the request itself is wrong, so repeating it verbatim is pointless.
 * Errors with no status are treated as retryable: those are the validation
 * failures and socket hangups that a fresh sample usually clears.
 */
export function isRetryableError(error: unknown): boolean {
  const status = getStatus(error);
  if (status === undefined) return true;
  if (status === 429) return true;
  return status >= 500;
}

function getStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  // Jitter so concurrent commands don't retry in lockstep.
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}
