const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../app');

function createRegistrationPool(vendor = { id: 'mamas-corner', owner_user_id: null }) {
  const calls = [];
  const client = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.startsWith('SELECT id, owner_user_id')) {
        return { rows: vendor ? [vendor] : [], rowCount: vendor ? 1 : 0 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return { calls, async connect() { return client; } };
}

test('public vendor registration links an unclaimed existing vendor', async (context) => {
  const pool = createRegistrationPool();
  const server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Staff Account',
      email: 'staff@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'vendor',
      vendorName: "Mama's Corner",
    }),
  });
  const data = await response.json();

  assert.equal(response.status, 201);
  assert.equal(data.role, 'vendor');
  assert.ok(pool.calls.some((call) => call.sql.startsWith('UPDATE vendors')));
  assert.ok(pool.calls.some((call) => call.sql === 'COMMIT'));
});

test('public vendor registration cannot claim an already-owned vendor', async (context) => {
  const pool = createRegistrationPool({ id: 'mamas-corner', owner_user_id: 'existing-owner' });
  const server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Another Vendor',
      email: 'another-vendor@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'vendor',
      vendorName: "Mama's Corner",
    }),
  });
  const data = await response.json();

  assert.equal(response.status, 409);
  assert.match(data.message, /already connected to an account/);
  assert.ok(pool.calls.some((call) => call.sql === 'ROLLBACK'));
});