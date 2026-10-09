const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../app');

const CLIENT_ORIGIN = 'https://cs-campus-food-vendor-pre-order-sys-ten.vercel.app';

async function startServer(context, pool) {
  const previousClientUrl = process.env.CLIENT_URL;
  process.env.CLIENT_URL = CLIENT_ORIGIN;
  const app = createApp(pool);
  if (previousClientUrl === undefined) {
    delete process.env.CLIENT_URL;
  } else {
    process.env.CLIENT_URL = previousClientUrl;
  }

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

test('health endpoint confirms database readiness', async (context) => {
  const server = await startServer(context, {
    async query(sql) {
      assert.equal(sql, 'SELECT 1');
      return { rows: [{ '?column?': 1 }] };
    },
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, {
    headers: { Origin: CLIENT_ORIGIN },
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(data, { success: true, status: 'ok' });
  assert.equal(response.headers.get('access-control-allow-origin'), CLIENT_ORIGIN);
});

test('health endpoint returns unavailable when database is unreachable', async (context) => {
  const server = await startServer(context, {
    async query() {
      throw new Error('database unavailable');
    },
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(data, { success: false, message: 'Service unavailable.' });
});

test('Vercel origin receives credentialed API preflight headers', async (context) => {
  const server = await startServer(context, { async query() { return { rows: [] }; } });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: CLIENT_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), CLIENT_ORIGIN);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /content-type/i);
});

test('unconfigured origins do not receive CORS access', async (context) => {
  const server = await startServer(context, { async query() { return { rows: [] }; } });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, {
    headers: { Origin: 'https://untrusted.example' },
  });

  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
