const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createApp } = require('../app');
const { createPool, initializeDatabase } = require('../database');

const envPath = path.join(__dirname, '..', '.env');
if (process.loadEnvFile && fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Tests can still use environment variables supplied by the runner.
  }
}

const campusVendor = {
  id: 'vendor-1',
  name: 'Campus Cafe',
  collectionLocation: 'Student Centre, Ground Floor',
  latitude: null,
  longitude: null,
};

function createMockPool(role = 'admin') {
  const calls = [];
  return {
    calls,
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql.includes('FROM sessions')) {
        return role ? { rows: [{ id: 'user-1', email: 'admin@example.test', full_name: 'Campus Admin', role }] } : { rows: [] };
      }
      if (sql.includes('UPDATE vendors')) {
        return {
          rows: [{ ...campusVendor, latitude: parameters[0], longitude: parameters[1] }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM vendors')) {
        return { rows: [campusVendor] };
      }
      if (sql.includes('FROM menu_items')) {
        return {
          rows: [{
            id: 'item-1',
            name: 'Toastie',
            vendor_id: campusVendor.id,
            vendor: campusVendor.name,
            collection_location: campusVendor.collectionLocation,
            latitude: -25.5404,
            longitude: 28.0945,
            price_cents: 2500,
            category: 'Meals',
            description: '',
            available: true,
            image_mime_type: null,
          }],
        };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

async function startServer(context, pool) {
  const server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

function adminHeaders() {
  return { Cookie: 'campus_eats_session=admin-test-session' };
}

test('vendor location management requires an admin session', async (context) => {
  const server = await startServer(context, createMockPool());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendors/locations`);
  assert.equal(response.status, 401);
});

test('non-admin users cannot manage vendor map locations', async (context) => {
  const server = await startServer(context, createMockPool('student'));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendors/locations`, {
    headers: adminHeaders(),
  });
  assert.equal(response.status, 403);
});

test('admin can load approved vendors and save a pin inside TUT Soshanguve South', async (context) => {
  const pool = createMockPool();
  const server = await startServer(context, pool);
  const listResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendors/locations`, {
    headers: adminHeaders(),
  });
  const listData = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listData.vendors[0].collectionLocation, campusVendor.collectionLocation);

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendors/vendor-1/location`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: -25.5404, longitude: 28.0945 }),
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.vendor.latitude, -25.5404);
  assert.equal(data.vendor.longitude, 28.0945);
  const update = pool.calls.find((call) => call.sql.includes('UPDATE vendors'));
  assert.deepEqual(update.parameters, [-25.5404, 28.0945, 'vendor-1']);
});

test('admin cannot save vendor pins outside the campus boundary', async (context) => {
  const pool = createMockPool();
  const server = await startServer(context, pool);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendors/vendor-1/location`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: -25.6, longitude: 28.1 }),
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.match(data.message, /inside TUT Soshanguve South campus/i);
  assert.equal(pool.calls.some((call) => call.sql.includes('UPDATE vendors')), false);
});

test('admin cannot save a pin inside the bounding box but outside the campus outline', async (context) => {
  const pool = createMockPool();
  const server = await startServer(context, pool);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendors/vendor-1/location`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: -25.5383537, longitude: 28.0908823 }),
  });

  assert.equal(response.status, 400);
  assert.equal(pool.calls.some((call) => call.sql.includes('UPDATE vendors')), false);
});

test('public menu returns vendor collection point and saved coordinates', async (context) => {
  const server = await startServer(context, createMockPool(null));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/menu`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.items[0].collectionLocation, campusVendor.collectionLocation);
  assert.equal(data.items[0].latitude, -25.5404);
  assert.equal(data.items[0].longitude, 28.0945);
});

test('vendor coordinates persist in PostgreSQL and appear in student discovery', {
  skip: !process.env.DATABASE_URL,
}, async (context) => {
  const pool = createPool();
  await initializeDatabase(pool);
  const suffix = randomUUID();
  const userId = randomUUID();
  const vendorId = `map-${suffix}`;
  const menuItemId = `map-item-${suffix}`;
  const sessionToken = `map-admin-${suffix}`;
  const sessionHash = createHash('sha256').update(sessionToken).digest('hex');

  await pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role, email_verified_at)
     VALUES ($1, 'Map Admin', $2, 'unused-hash', 'admin', NOW())`,
    [userId, `map-admin-${suffix}@example.test`],
  );
  await pool.query(
    `INSERT INTO vendors (id, name, category, owner_user_id, collection_location)
     VALUES ($1, $2, 'Meals', $3, 'Building 2, Student Centre')`,
    [vendorId, `Map Test Vendor ${suffix}`, userId],
  );
  await pool.query(
    `INSERT INTO menu_items (id, vendor_id, name, price_cents, category)
     VALUES ($1, $2, 'Test Toastie', 2500, 'Meals')`,
    [menuItemId, vendorId],
  );
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 hour\')',
    [sessionHash, userId],
  );

  const server = await startServer(context, pool);
  context.after(async () => {
    await pool.query('DELETE FROM menu_items WHERE id = $1', [menuItemId]);
    await pool.query('DELETE FROM collection_slots WHERE vendor_id = $1', [vendorId]);
    await pool.query('DELETE FROM vendors WHERE id = $1', [vendorId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  const adminHeaders = { Cookie: `campus_eats_session=${sessionToken}` };
  const saveResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/vendors/${vendorId}/location`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: -25.5404, longitude: 28.0945 }),
  });
  assert.equal(saveResponse.status, 200);

  const locationRows = await pool.query('SELECT latitude, longitude FROM vendors WHERE id = $1', [vendorId]);
  assert.equal(locationRows.rows[0].latitude, -25.5404);
  assert.equal(locationRows.rows[0].longitude, 28.0945);

  const menuResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/menu`);
  const menuData = await menuResponse.json();
  const mapItem = menuData.items.find((item) => item.vendorId === vendorId);
  assert.equal(mapItem.collectionLocation, 'Building 2, Student Centre');
  assert.equal(mapItem.latitude, -25.5404);
  assert.equal(mapItem.longitude, 28.0945);
});