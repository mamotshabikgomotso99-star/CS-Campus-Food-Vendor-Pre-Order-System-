const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createApp, hashPassword, verifyPassword } = require('../app');
const { createPool, initializeDatabase } = require('../database');
const { createSmtpMailer, createSmtpVerificationMailer } = require('../email');

const envPath = path.join(__dirname, '..', '.env');
if (process.loadEnvFile && fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Tests can still use environment variables supplied by the runner.
  }
}

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
  return {
    calls,
    get connectionCount() { return connectionCount; },
    async connect() { connectionCount += 1; return client; },
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      return { rows: [], rowCount: 0 };
    },
  };
}

function createLoginPool(user) {
  const calls = [];
  return {
    calls,
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.includes('FROM users WHERE email = $1')) {
        return { rows: [user], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
  };
}

function createAdminPool(vendorRequest) {
  const calls = [];
  const admin = { id: 'admin-id', email: 'admin@example.test', full_name: 'Campus Admin', role: 'admin' };
  const client = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.includes('FROM vendor_requests WHERE id')) return { rows: [vendorRequest], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return {
    calls,
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.includes('FROM sessions')) return { rows: [admin], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async connect() { return client; },
  };
}

function createPasswordResetPool({ user = null, token = null } = {}) {
  const calls = [];
  const client = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.includes('FROM password_reset_tokens')) return { rows: token ? [token] : [], rowCount: token ? 1 : 0 };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return {
    calls,
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.includes('SELECT id, email FROM users')) return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      return { rows: [], rowCount: 0 };
    },
    async connect() { return client; },
  };
}

async function startRegistrationServer(context, pool, dependencies = {}) {
  const server = createApp(pool, {
    sendVerificationEmail: async () => {},
    verificationClientOrigin: 'http://127.0.0.1:3000',
    requireEmailVerification: true,
    ...dependencies,
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

test('SMTP sender builds authenticated transport and sends reset email', async () => {
  let transportConfiguration;
  let message;
  const mailer = createSmtpMailer({
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'smtp-test-user',
    SMTP_PASS: 'smtp-test-password',
    EMAIL_FROM: 'Campus Eats <reset@example.test>',
  }, (configuration) => {
    transportConfiguration = configuration;
    return { async sendMail(payload) { message = payload; } };
  });

  await mailer('student@example.test', 'https://campus.example.test/reset-password?token=fake-token');

  assert.equal(transportConfiguration.host, 'smtp.example.test');
  assert.equal(transportConfiguration.port, 587);
  assert.equal(transportConfiguration.secure, false);
  assert.equal(message.to, 'student@example.test');
  assert.match(message.text, /fake-token/);
  assert.equal(createSmtpMailer({ SMTP_HOST: '', SMTP_PORT: '0' }), null);
});

test('SMTP verification sender delivers a one-time verification link', async () => {
  let message;
  const mailer = createSmtpVerificationMailer({
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    EMAIL_FROM: 'Campus Eats <verify@example.test>',
  }, () => ({ async sendMail(payload) { message = payload; } }));

  await mailer('student@example.test', 'https://campus.example.test/verify-email?token=fake-token');

  assert.equal(message.to, 'student@example.test');
  assert.match(message.subject, /verify/i);
  assert.match(message.text, /fake-token/);
  assert.equal(createSmtpVerificationMailer({ SMTP_HOST: '', SMTP_PORT: '0' }), null);
});

test('student registration emails a link and stores only its token hash', async (context) => {
  const pool = createRegistrationPool();
  let sentEmail;
  let sentUrl;
  const server = await startRegistrationServer(context, pool, {
    sendVerificationEmail: async (email, url) => { sentEmail = email; sentUrl = url; },
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Verified Student',
      email: 'verified@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'student',
    }),
  });
  const data = await response.json();
  const token = new URL(sentUrl).searchParams.get('token');
  const tokenInsert = pool.calls.find((call) => call.sql.includes('INSERT INTO email_verification_tokens'));
  const storedHash = tokenInsert.parameters[2];

  assert.equal(response.status, 201);
  assert.equal(data.verificationSent, true);
  assert.equal(sentEmail, 'verified@example.test');
  assert.equal(new URL(sentUrl).pathname, '/verify-email');
  assert.equal(storedHash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(storedHash, token);
});

test('verification resend is generic for an unknown address', async (context) => {
  const pool = createRegistrationPool();
  let emailSent = false;
  const server = await startRegistrationServer(context, pool, {
    sendVerificationEmail: async () => { emailSent = true; },
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown@example.test' }),
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.match(data.message, /if an unverified student account exists/i);
  assert.equal(emailSent, false);
});

test('local registration can complete without SMTP and does not require verification', async (context) => {
  const pool = createRegistrationPool();
  const server = await startRegistrationServer(context, pool, {
    sendVerificationEmail: null,
    verificationClientOrigin: '',
    requireEmailVerification: false,
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Local Student',
      email: 'local-student@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'student',
    }),
  });
  const data = await response.json();

  assert.equal(response.status, 201);
  assert.equal(data.verificationRequired, false);
  assert.equal(data.verificationSent, false);
  assert.match(data.message, /you can sign in now/i);
  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO users')));
});

test('production registration refuses to create an account when verification email is unavailable', async (context) => {
  const pool = createRegistrationPool();
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let server;
  try {
    server = await startRegistrationServer(context, pool, {
      sendVerificationEmail: null,
      verificationClientOrigin: '',
      requireEmailVerification: false,
    });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Production Student',
      email: 'production-student@example.test',
      password: 'valid-password-123',
      confirmPassword: 'valid-password-123',
      role: 'student',
    }),
  });

  assert.equal(response.status, 503);
  assert.equal(pool.connectionCount, 0);
});

test('local development permits unverified student sign-in', async (context) => {
  const password = 'local-password-123';
  const pool = createLoginPool({
    id: 'local-student',
    email: 'local-student@example.test',
    full_name: 'Local Student',
    role: 'student',
    password_hash: await hashPassword(password),
    email_verified_at: null,
  });
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let server;
  try {
    server = await startRegistrationServer(context, pool, { requireEmailVerification: false });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'local-student@example.test', password }),
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.ok(response.headers.get('set-cookie'));
  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO sessions')));
});

test('production always requires student email verification', async (context) => {
  const password = 'production-password-123';
  const pool = createLoginPool({
    id: 'production-student',
    email: 'production-student@example.test',
    full_name: 'Production Student',
    role: 'student',
    password_hash: await hashPassword(password),
    email_verified_at: null,
  });
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let server;
  try {
    server = await startRegistrationServer(context, pool, { requireEmailVerification: false });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'production-student@example.test', password }),
  });
  const data = await response.json();

  assert.equal(response.status, 403);
  assert.equal(data.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(pool.calls.some((call) => call.sql.includes('INSERT INTO sessions')), false);
});

test('forgot password returns the same generic response for unknown email', async (context) => {
  const pool = createPasswordResetPool();
  let emailSent = false;
  const server = await startRegistrationServer(context, pool, {
    sendPasswordResetEmail: async () => { emailSent = true; },
    passwordResetClientOrigin: 'http://127.0.0.1:3000',
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown@example.test' }),
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.match(data.message, /if an account exists/i);
  assert.equal(emailSent, false);
});

test('reset endpoint rejects an expired or unknown token', async (context) => {
  const pool = createPasswordResetPool();
  const server = await startRegistrationServer(context, pool);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'expired-token', password: 'new-password-123', confirmPassword: 'new-password-123' }),
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.match(data.message, /invalid or has expired/i);
  assert.equal(pool.calls.some((call) => call.sql.includes('UPDATE users SET password_hash')), false);
});

test('password reset consumes a token once and revokes sessions in PostgreSQL', {
  skip: !process.env.DATABASE_URL,
}, async (context) => {
  const pool = createPool();
  await initializeDatabase(pool);
  const suffix = randomUUID();
  const email = `password-reset-${suffix}@example.test`;
  const userId = randomUUID();
  const oldPassword = 'Old-password-123';
  const newPassword = 'New-password-456';
  const sessionHash = `password-reset-session-${suffix}`;
  await pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'student')`,
    [userId, 'Password Reset Test', email, await hashPassword(oldPassword)],
  );
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 hour\')',
    [sessionHash, userId],
  );

  context.after(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  let resetLink = '';
  const server = await startRegistrationServer(context, pool, {
    passwordResetClientOrigin: 'http://127.0.0.1:3000',
    sendPasswordResetEmail: async (recipient, link) => {
      assert.equal(recipient, email);
      resetLink = link;
    },
  });
  const forgotResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const forgotData = await forgotResponse.json();
  const token = new URL(resetLink).searchParams.get('token');
  const storedToken = await pool.query(
    'SELECT token_hash FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
    [userId],
  );

  assert.equal(forgotResponse.status, 200);
  assert.match(forgotData.message, /if an account exists/i);
  assert.ok(token);
  assert.notEqual(storedToken.rows[0].token_hash, token);
  assert.equal(storedToken.rows[0].token_hash, createHash('sha256').update(token).digest('hex'));

  const resetResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: newPassword, confirmPassword: newPassword }),
  });
  assert.equal(resetResponse.status, 200);
  const updatedUser = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  assert.equal(await verifyPassword(newPassword, updatedUser.rows[0].password_hash), true);
  assert.equal(await verifyPassword(oldPassword, updatedUser.rows[0].password_hash), false);

  const remainingSessions = await pool.query('SELECT token_hash FROM sessions WHERE user_id = $1', [userId]);
  assert.equal(remainingSessions.rowCount, 0);

  const replayResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: newPassword, confirmPassword: newPassword }),
  });
  assert.equal(replayResponse.status, 400);

  const expiredToken = `expired-${suffix}`;
  await pool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute')`,
    [randomUUID(), userId, createHash('sha256').update(expiredToken).digest('hex')],
  );
  const expiredResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: expiredToken, password: newPassword, confirmPassword: newPassword }),
  });
  assert.equal(expiredResponse.status, 400);
});

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

test('vendor application creates a pending request without creating an account', async (context) => {
  const pool = createRegistrationPool();
  const server = await startRegistrationServer(context, pool);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/vendor-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Vendor Applicant', email: 'vendor@example.test',
      password: 'valid-password-123', confirmPassword: 'valid-password-123',
      vendorName: 'Campus Kitchen', category: 'Meals',
      collectionLocation: 'Student Centre', openingTime: '09:00', closingTime: '16:00',
      preparationTimeMinutes: 30,
    }),
  });
  const data = await response.json();

  assert.equal(response.status, 201);
  assert.match(data.message, /admin review/i);
  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO vendor_requests')));
  assert.equal(pool.calls.some((call) => call.sql.includes('INSERT INTO users')), false);
});

test('vendor application persists operating details in PostgreSQL', {
  skip: !process.env.DATABASE_URL,
}, async (context) => {
  const pool = createPool();
  await initializeDatabase(pool);
  const server = await startRegistrationServer(context, pool);
  const suffix = randomUUID();
  const email = `vendor-application-${suffix}@example.test`;

  context.after(async () => {
    await pool.query('DELETE FROM vendor_requests WHERE email = $1', [email]);
    await pool.end();
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/vendor-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Temporary Integration Applicant',
      email,
      password: 'TemporaryPass123!',
      confirmPassword: 'TemporaryPass123!',
      vendorName: `Integration Vendor ${suffix}`,
      category: 'Meals',
      collectionLocation: 'Integration Test Point',
      openingTime: '09:00',
      closingTime: '16:00',
      preparationTimeMinutes: 30,
    }),
  });
  const data = await response.json();
  const storedRequest = await pool.query(
    `SELECT collection_location, opening_time::text AS opening_time,
            closing_time::text AS closing_time, preparation_time_minutes
       FROM vendor_requests WHERE email = $1`,
    [email],
  );

  assert.equal(response.status, 201);
  assert.match(data.message, /admin review/i);
  assert.deepEqual(storedRequest.rows[0], {
    collection_location: 'Integration Test Point',
    opening_time: '09:00:00',
    closing_time: '16:00:00',
    preparation_time_minutes: 30,
  });
});

test('admin vendor request queue requires an admin session', async (context) => {
  const pool = createRegistrationPool();
  const server = await startRegistrationServer(context, pool);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendor-requests`);

  assert.equal(response.status, 401);
  assert.equal(pool.calls.some((call) => call.sql.includes('FROM vendor_requests')), false);
});

test('admin approval creates an active vendor account and profile', async (context) => {
  const pool = createAdminPool({
    id: 'request-id', full_name: 'Vendor Applicant', email: 'vendor@example.test',
    password_hash: 'stored-password-hash', vendor_name: 'Campus Kitchen', category: 'Meals',
    collection_location: 'Student Centre', opening_time: '09:00:00', closing_time: '16:00:00',
    preparation_time_minutes: 30,
  });
  const server = await startRegistrationServer(context, pool);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendor-requests/request-id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: 'campus_eats_session=test-session' },
    body: JSON.stringify({ status: 'approved' }),
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.status, 'approved');
  assert.ok(pool.calls.some((call) => call.sql.includes("VALUES ($1, $2, $3, $4, 'vendor')")));
  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO vendors')));
  assert.ok(pool.calls.some((call) => call.sql === 'COMMIT'));
});

test('student email verification gates login and consumes links once in PostgreSQL', {
  skip: !process.env.DATABASE_URL,
}, async (context) => {
  const pool = createPool();
  await initializeDatabase(pool);
  const suffix = randomUUID();
  const email = `email-verification-${suffix}@example.test`;
  let verificationUrl = '';
  const server = await startRegistrationServer(context, pool, {
    sendVerificationEmail: async (recipient, url) => {
      assert.equal(recipient, email);
      verificationUrl = url;
    },
  });

  context.after(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    await pool.end();
  });

  const registerResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Email Verification Test',
      email,
      password: 'verified-password-123',
      confirmPassword: 'verified-password-123',
      role: 'student',
    }),
  });
  assert.equal(registerResponse.status, 201);
  const originalToken = new URL(verificationUrl).searchParams.get('token');
  assert.ok(originalToken);

  const loginBeforeVerification = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'verified-password-123' }),
  });
  const loginError = await loginBeforeVerification.json();
  assert.equal(loginBeforeVerification.status, 403);
  assert.equal(loginError.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(loginBeforeVerification.headers.get('set-cookie'), null);

  const resendResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert.equal(resendResponse.status, 200);
  const replacementToken = new URL(verificationUrl).searchParams.get('token');
  assert.notEqual(replacementToken, originalToken);

  const originalTokenResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/confirm-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: originalToken }),
  });
  assert.equal(originalTokenResponse.status, 400);

  const expiredToken = `expired-${suffix}`;
  await pool.query(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
     SELECT $1, id, $2, NOW() - INTERVAL '1 minute' FROM users WHERE email = $3`,
    [randomUUID(), createHash('sha256').update(expiredToken).digest('hex'), email],
  );
  const expiredTokenResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/confirm-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: expiredToken }),
  });
  assert.equal(expiredTokenResponse.status, 400);

  const confirmResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/confirm-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: replacementToken }),
  });
  assert.equal(confirmResponse.status, 200);

  const loginAfterVerification = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'verified-password-123' }),
  });
  assert.equal(loginAfterVerification.status, 200);
  assert.ok(loginAfterVerification.headers.get('set-cookie'));

  const replayResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/confirm-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: replacementToken }),
  });
  assert.equal(replayResponse.status, 400);
});