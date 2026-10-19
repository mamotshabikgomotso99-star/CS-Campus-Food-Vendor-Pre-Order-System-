const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID, scrypt } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

async function createAdmin() {
  const envPath = path.join(__dirname, '..', '.env');
  if (process.loadEnvFile && fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const fullName = (process.env.ADMIN_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_NAME, and an ADMIN_PASSWORD of at least 12 characters in server/.env.');
  }

  const { createPool, initializeDatabase } = require('../database');
  const pool = createPool();
  try {
    await initializeDatabase(pool);
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [randomUUID(), fullName, email, await hashPassword(password)],
    );

    );
    console.log(`Admin account created for ${email}.`);
  } finally {
    await pool.end();
  }
}

createAdmin().catch((error) => {
  console.error(error.message || 'Unable to create the admin account.');
  process.exitCode = 1;
});