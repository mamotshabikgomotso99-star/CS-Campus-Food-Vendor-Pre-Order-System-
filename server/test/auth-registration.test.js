const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../app');

function createRegistrationPool() {
  const calls = [];
  let connectionCount = 0;
  const client = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return { calls, get connectionCount() { return connectionCount; }, async connect() { connectionCount += 1; return client; } };
}

async function startRegistrationServer(context, pool) {
  const server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

test('public vendor registration is rejected before database access', async (context) => {
  const pool = createRegistrationPool();
  const server = await startRegistrationServer(context, pool);

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

  assert.equal(response.status, 403);
  assert.match(data.message, /must be provisioned/);
  assert.equal(pool.connectionCount, 0);
});

test('public registration rejects unsupported roles', async (context) => {
  const pool = createRegistrationPool();
  const server = await startRegistrationServer(context, pool);

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Another Vendor',
      email: 'another-vendor@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'admin',
      studentNumber: '123456',
    }),
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(pool.connectionCount, 0);
});

test('public student registration still creates a student account', async (context) => {
  const pool = createRegistrationPool();
  const server = await startRegistrationServer(context, pool);

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Student Account',
      email: 'student@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'student',
      studentNumber: '123456',
    }),
  });
  const data = await response.json();

  assert.equal(response.status, 201);
  assert.equal(data.role, 'student');
  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO users')));
  assert.ok(pool.calls.some((call) => call.sql === 'COMMIT'));
});

test('public student registration accepts a missing student number', async (context) => {
  const pool = createRegistrationPool();
  const server = await startRegistrationServer(context, pool);

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Student Without Number',
      email: 'student-without-number@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'student',
    }),
  });
  const data = await response.json();
  const insertCall = pool.calls.find((call) => call.sql.includes('INSERT INTO users'));

  assert.equal(response.status, 201);
  assert.equal(data.role, 'student');
  assert.equal(insertCall.parameters[5], null);
});