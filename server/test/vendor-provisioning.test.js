const assert = require('node:assert/strict');
const test = require('node:test');
const { createVendorLogin } = require('../vendor-provisioning');

function createMockPool(vendor) {
  const calls = [];
  const client = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.startsWith('SELECT id, owner_user_id')) {
        return { rows: vendor ? [vendor] : [], rowCount: vendor ? 1 : 0 };
      }
      if (sql.startsWith('UPDATE vendors')) {
        return { rows: [], rowCount: vendor?.owner_user_id ? 0 : 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return {
    calls,
    async connect() { return client; },
  };
}

test('vendor login is created with a password hash and linked transactionally', async () => {
  const pool = createMockPool({ id: 'fresh-bites', owner_user_id: null });
  const result = await createVendorLogin(pool, {
    vendorId: 'fresh-bites',
    fullName: 'Vendor Operator',
    email: 'OWNER@EXAMPLE.TEST',
    password: 'initial-password-123',
  });

  const insert = pool.calls.find((call) => call.sql.includes('INSERT INTO users'));
  assert.equal(result.vendorId, 'fresh-bites');
  assert.equal(insert.parameters[2], 'owner@example.test');
  assert.match(insert.sql, /'vendor'/);
  assert.match(insert.parameters[3], /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.notEqual(insert.parameters[3], 'initial-password-123');
  assert.ok(pool.calls.some((call) => call.sql === 'COMMIT'));
});

test('vendor login creation rejects an already-owned vendor and rolls back', async () => {
  const pool = createMockPool({ id: 'fresh-bites', owner_user_id: 'existing-owner' });

  await assert.rejects(
    createVendorLogin(pool, {
      vendorId: 'fresh-bites',
      fullName: 'Vendor Operator',
      email: 'owner@example.test',
      password: 'initial-password-123',
    }),
    /already has a login account/,
  );
  assert.ok(pool.calls.some((call) => call.sql === 'ROLLBACK'));
  assert.ok(!pool.calls.some((call) => call.sql.includes('INSERT INTO users')));
});