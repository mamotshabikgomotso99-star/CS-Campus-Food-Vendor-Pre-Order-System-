const { randomBytes, randomUUID, scrypt } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

async function createVendorLogin(pool, { vendorId, fullName, email, password }) {
  const normalizedName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!vendorId || !normalizedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 12) {
    throw new Error('Provide a vendor, valid name and email, and a password of at least 12 characters.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const vendorResult = await client.query(
      'SELECT id, owner_user_id FROM vendors WHERE id = $1 FOR UPDATE',
      [vendorId],
    );
    const vendor = vendorResult.rows[0];
    if (!vendor) {
      throw new Error('The selected vendor does not exist.');
    }
    if (vendor.owner_user_id) {
      throw new Error('This vendor already has a login account.');
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'vendor')`,
      [userId, normalizedName, normalizedEmail, passwordHash],
    );

    const linkResult = await client.query(
      'UPDATE vendors SET owner_user_id = $1 WHERE id = $2 AND owner_user_id IS NULL',
      [userId, vendorId],
    );
    if (linkResult.rowCount !== 1) {
      throw new Error('Unable to link the account to this vendor.');
    }

    await client.query('COMMIT');
    return { userId, vendorId };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createVendorLogin };