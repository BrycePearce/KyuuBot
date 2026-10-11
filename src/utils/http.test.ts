import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ReadableStream } from 'node:stream/web';
import test from 'node:test';
import { fetchBuffer, HttpStatusError, ResponseSizeError } from './http';

test('downloads binary bytes without changing them', async () => {
  const bytes = Buffer.from([0, 1, 255, 128]);
  assert.deepEqual(
    await fetchBuffer('https://example.test', {
      fetch: async () => new Response(bytes),
      maxBytes: bytes.length,
    }),
    bytes
  );
});

for (const contentLength of [undefined, '1', '100']) {
  test(`enforces body limit and cancels the stream (content-length: ${contentLength})`, async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
      },
      cancel() {
        cancelled = true;
      },
    });
    await assert.rejects(
      fetchBuffer('https://example.test', {
        maxBytes: 4,
        fetch: async () =>
          new Response(body, {
            headers: contentLength ? { 'content-length': contentLength } : {},
          }),
      }),
      ResponseSizeError
    );
    assert.equal(cancelled, true);
  });
}

test('retries transient status responses and stops after the configured count', async () => {
  let requests = 0;
  await assert.rejects(
    fetchBuffer('https://example.test?secret=hidden', {
      retries: 2,
      fetch: async () => {
        requests++;
        return new Response('private response', { status: 503, headers: { 'retry-after': '0' } });
      },
    }),
    (error: HttpStatusError) => {
      assert.equal(error.status, 503);
      assert.equal(error.message, 'HTTP request failed with status 503');
      return true;
    }
  );
  assert.equal(requests, 3);
});

test('does not retry permanent status errors', async () => {
  let requests = 0;
  await assert.rejects(
    fetchBuffer('https://example.test', {
      fetch: async () => {
        requests++;
        return new Response(null, { status: 404 });
      },
    }),
    HttpStatusError
  );
  assert.equal(requests, 1);
});

test('recovers from a network failure', async () => {
  let requests = 0;
  const result = await fetchBuffer('https://example.test', {
    fetch: async () => {
      if (++requests === 1) throw new TypeError('fetch failed');
      return new Response('recovered');
    },
  });
  assert.equal(result.toString(), 'recovered');
  assert.equal(requests, 2);
});

test('cancellation interrupts retry backoff without another request', async () => {
  const controller = new AbortController();
  let requests = 0;
  const request = fetchBuffer('https://example.test', {
    signal: controller.signal,
    fetch: async () => {
      requests++;
      return new Response(null, { status: 429, headers: { 'retry-after': '9999999' } });
    },
  });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(requests, 1);
});

test('an already aborted request never starts the transport', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchBuffer('https://example.test', {
      signal: controller.signal,
      fetch: async () => {
        assert.fail('transport must not run');
      },
    }),
    { name: 'AbortError' }
  );
});

test('deadline covers a stalled response body and prevents retry', async () => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(200);
    response.write('partial');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    await assert.rejects(fetchBuffer(`http://127.0.0.1:${address.port}`, { timeoutMs: 100 }), {
      name: 'TimeoutError',
    });
    assert.equal(requests, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
