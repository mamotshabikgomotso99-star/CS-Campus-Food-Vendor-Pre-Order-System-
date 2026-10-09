const { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const { ensureCollectionSlots } = require('./database');

const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = 'campus_eats_session';
const SERVICE_FEE_CENTS = 500;
const FIRST_ORDER_DISCOUNT_PERCENT = 20;
const MAX_MENU_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MENU_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const menuImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MENU_IMAGE_BYTES, files: 1 },
  fileFilter(request, file, callback) {
    if (!ALLOWED_MENU_IMAGE_TYPES.has(file.mimetype)) {
      const error = new Error('Choose a JPEG, PNG, or WebP image.');
      error.code = 'INVALID_MENU_IMAGE_TYPE';
      callback(error);
      return;
    }
    callback(null, true);
  },
});
const allowedTransitions = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready for Collection'],
  'Ready for Collection': ['Collected'],
  Collected: [],
  Cancelled: [],
};

function isValidMenuImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0 || file.buffer.length > MAX_MENU_IMAGE_BYTES) {
    return false;
  }
  const bytes = file.buffer;
  if (file.mimetype === 'image/png') {
    return bytes.length >= 45 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR' &&
      bytes.subarray(-12, -8).equals(Buffer.from([0, 0, 0, 0])) &&
      bytes.toString('ascii', bytes.length - 8, bytes.length - 4) === 'IEND';
  }
  if (file.mimetype === 'image/jpeg') {
    return bytes.length >= 16 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
      bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  if (file.mimetype === 'image/webp') {
    return bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.readUInt32LE(4) === bytes.length - 8 && bytes.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function menuImageUrl(itemId) {
  return `/api/menu-items/${encodeURIComponent(itemId)}/image`;
}

function vendorMenuImageUrl(itemId) {
  return `/api/vendor/menu/${encodeURIComponent(itemId)}/image`;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [saltHex, expectedHex] = storedHash.split(':');
  if (!saltHex || !expectedHex) {
    return false;
  }

  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readCookie(request, name) {
  const cookies = request.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0 || cookie.slice(0, separatorIndex).trim() !== name) {
      continue;
    }
    return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
  }
  return '';
}

function setSessionCookie(response, token, maxAgeSeconds) {
  const cookieParts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }
  response.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearSessionCookie(response) {
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  );
}

function getAllowedOrigins() {
  const configured = (process.env.CLIENT_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const localOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  return new Set([...configured, ...localOrigins]);
}

function orderSummary(items) {
  return items.map((item) => `${item.name} x${item.quantity}`).join(', ');
}

async function loadOrder(pool, orderId) {
  const result = await pool.query(
    `SELECT o.id, o.order_number, o.vendor_id, v.name AS vendor_name,
            o.student_id, u.full_name AS student_name,
            o.subtotal_cents, o.discount_cents, o.service_fee_cents, o.total_cents,
            o.status, o.created_at, s.starts_at AS collection_at
       FROM orders o
       JOIN vendors v ON v.id = o.vendor_id
       JOIN users u ON u.id = o.student_id
       JOIN collection_slots s ON s.id = o.collection_slot_id
      WHERE o.id = $1`,
    [orderId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const itemsResult = await pool.query(
    `SELECT item_name AS name, unit_price_cents, quantity, line_total_cents
       FROM order_items WHERE order_id = $1 ORDER BY item_name`,
    [orderId],
  );
  const items = itemsResult.rows.map((item) => ({
    name: item.name,
    unitPriceCents: item.unit_price_cents,
    quantity: item.quantity,
    lineTotalCents: item.line_total_cents,
  }));

  return {
    id: row.order_number,
    orderId: row.id,
    vendorId: row.vendor_id,
    vendor: row.vendor_name,
    student: row.student_name,
    items: orderSummary(items),
    itemLines: items,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    serviceFeeCents: row.service_fee_cents,
    totalCents: row.total_cents,
    status: row.status,
    collectionAt: new Date(row.collection_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function createApp(pool) {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed.'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', async (request, response) => {
    try {
      await pool.query('SELECT 1');
      response.json({ success: true, status: 'ok' });
    } catch {
      response.status(503).json({ success: false, message: 'Service unavailable.' });
    }
  });

  const requireRole = (role) => async (request, response, next) => {
    try {
      const token = readCookie(request, SESSION_COOKIE);
      if (!token) {
        response.status(401).json({ success: false, message: 'Please sign in to continue.' });
        return;
      }

      const result = await pool.query(
        `SELECT u.id, u.email, u.full_name, u.role
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [hashToken(token)],
      );
      const user = result.rows[0];
      if (!user) {
        response.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
        return;
      }
      if (role && user.role !== role) {
        response.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
        return;
      }

      request.user = user;
      next();
    } catch {
      response.status(500).json({ success: false, message: 'Unable to verify your session right now.' });
    }
  };

  const parseMenuImage = (request, response, next) => {
    menuImageUpload.single('image')(request, response, (error) => {
      if (error) {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        response.status(status).json({
          success: false,
          message: error.code === 'LIMIT_FILE_SIZE'
            ? 'Choose an image smaller than 2 MB.'
            : error.message || 'Unable to read the uploaded image.',
        });
        return;
      }
      if (request.file && !isValidMenuImage(request.file)) {
        response.status(400).json({ success: false, message: 'The image contents do not match a supported JPEG, PNG, or WebP file.' });
        return;
      }
      next();
    });
  };

  app.post('/api/auth/register', async (request, response) => {
    const fullName = typeof request.body.fullName === 'string' ? request.body.fullName.trim() : '';
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const role = request.body.role;
    const studentNumber = typeof request.body.studentNumber === 'string'
      ? request.body.studentNumber.trim() || null
      : null;

    if (role === 'vendor') {
      response.status(403).json({ success: false, message: 'Vendor accounts must be provisioned by an administrator.' });
      return;
    }

    if (
      !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 ||
      role !== 'student' ||
      (request.body.confirmPassword && request.body.confirmPassword !== password)
    ) {
      response.status(400).json({ success: false, message: 'Please provide valid account details.' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userId = randomUUID();
      const passwordHash = await hashPassword(password);
      await client.query(
        `INSERT INTO users (id, full_name, email, password_hash, role, student_number)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, fullName, email, passwordHash, role, studentNumber],
      );

      await client.query('COMMIT');
      response.status(201).json({ success: true, message: 'Account created. Please sign in to continue.', role });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') {
        response.status(409).json({ success: false, message: 'An account with these details already exists.' });
        return;
      }
      response.status(500).json({ success: false, message: 'Unable to create your account right now.' });
    } finally {
      client.release();
    }
  });

  app.post('/api/auth/login', async (request, response) => {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    try {
      const result = await pool.query(
        'SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1',
        [email],
      );
      const user = result.rows[0];
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        response.status(401).json({ success: false, message: 'Invalid email or password.' });
        return;
      }

      const token = randomBytes(32).toString('base64url');
      const maxAgeSeconds = request.body.remember === false ? 86_400 : 2_592_000;
      const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
      await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
      await pool.query(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [hashToken(token), user.id, expiresAt.toISOString()],
      );
      setSessionCookie(response, token, maxAgeSeconds);
      response.json({
        success: true,
        message: 'Login successful.',
        role: user.role,
        user: { email: user.email, fullName: user.full_name, role: user.role },
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to sign in right now.' });
    }
  });

  app.get('/api/auth/me', requireRole(), (request, response) => {
    response.json({
      success: true,
      user: {
        email: request.user.email,
        fullName: request.user.full_name,
        role: request.user.role,
      },
    });
  });

  app.post('/api/auth/logout', async (request, response) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) {
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]).catch(() => {});
    }
    clearSessionCookie(response);
    response.json({ success: true, message: 'Signed out.' });
  });

  app.post('/api/auth/forgot-password', (request, response) => {
    response.json({ success: true, message: 'Password reset is not configured for this prototype.' });
  });

  app.post('/api/auth/reset-password', (request, response) => {
    response.status(501).json({ success: false, message: 'Password reset verification is not configured yet.' });
  });

  app.post('/api/auth/verify-email', (request, response) => {
    response.json({ success: true, message: 'Email verification is not configured for this prototype.' });
  });

  app.get('/api/menu', async (request, response) => {
    try {
      const values = [];
      let vendorFilter = '';
      if (typeof request.query.vendorId === 'string' && request.query.vendorId) {
        values.push(request.query.vendorId);
        vendorFilter = 'AND m.vendor_id = $1';
      }
      const result = await pool.query(
        `SELECT m.id, m.name, m.vendor_id, v.name AS vendor, m.price_cents,
          m.category, m.description, m.available, m.image_mime_type
           FROM menu_items m JOIN vendors v ON v.id = m.vendor_id
          WHERE m.available = TRUE ${vendorFilter}
          ORDER BY v.name, m.name`,
        values,
      );
      response.json({
        success: true,
        items: result.rows.map((item) => ({
          id: item.id,
          name: item.name,
          vendorId: item.vendor_id,
          vendor: item.vendor,
          priceCents: item.price_cents,
          category: item.category,
          description: item.description,
          available: item.available,
          imageUrl: item.image_mime_type ? menuImageUrl(item.id) : null,
        })),
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load the menu right now.' });
    }
  });

  app.get('/api/menu-items/:itemId/image', async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT image_mime_type, image_data
           FROM menu_items
          WHERE id = $1 AND available = TRUE AND image_data IS NOT NULL`,
        [request.params.itemId],
      );
      if (!result.rows[0]) {
        response.status(404).json({ success: false, message: 'Menu image not found.' });
        return;
      }
      response
        .type(result.rows[0].image_mime_type)
        .set('Cache-Control', 'public, max-age=0, must-revalidate')
        .set('X-Content-Type-Options', 'nosniff')
        .send(result.rows[0].image_data);
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load this menu image right now.' });
    }
  });

  app.get('/api/vendor/menu', requireRole('vendor'), async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT m.id, m.name, m.vendor_id, v.name AS vendor, m.price_cents,
          m.category, m.description, m.available, m.image_mime_type
           FROM menu_items m
           JOIN vendors v ON v.id = m.vendor_id
          WHERE v.owner_user_id = $1
          ORDER BY m.name`,
        [request.user.id],
      );
      response.json({
        success: true,
        items: result.rows.map((item) => ({
          id: item.id,
          name: item.name,
          vendorId: item.vendor_id,
          vendor: item.vendor,
          priceCents: item.price_cents,
          category: item.category,
          description: item.description,
          available: item.available,
          imageUrl: item.image_mime_type ? vendorMenuImageUrl(item.id) : null,
        })),
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load your menu right now.' });
    }
  });

  app.get('/api/vendor/menu/:itemId/image', requireRole('vendor'), async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT m.image_mime_type, m.image_data
           FROM menu_items m
           JOIN vendors v ON v.id = m.vendor_id
          WHERE m.id = $1 AND v.owner_user_id = $2 AND m.image_data IS NOT NULL`,
        [request.params.itemId, request.user.id],
      );
      if (!result.rows[0]) {
        response.status(404).json({ success: false, message: 'Menu image not found in your menu.' });
        return;
      }
      response
        .type(result.rows[0].image_mime_type)
        .set('Cache-Control', 'private, no-store')
        .set('X-Content-Type-Options', 'nosniff')
        .send(result.rows[0].image_data);
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load this menu image right now.' });
    }
  });

  const validateMenuItem = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null;
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const rawPriceCents = body.priceCents;
    const priceCents = typeof rawPriceCents === 'string' && /^\d+$/.test(rawPriceCents)
      ? Number(rawPriceCents)
      : rawPriceCents;
    const rawAvailable = body.available;
    const available = rawAvailable === 'true' ? true : rawAvailable === 'false' ? false : rawAvailable;

    if (
      !name || name.length > 100 || !category || category.length > 80 ||
      description.length > 300 || !Number.isSafeInteger(priceCents) ||
      priceCents < 1 || priceCents > 1_000_000 || typeof available !== 'boolean'
    ) {
      return null;
    }
    return { name, category, description, priceCents, available };
  };

  app.post('/api/vendor/menu', requireRole('vendor'), parseMenuImage, async (request, response) => {
    const item = validateMenuItem(request.body);
    if (!item) {
      response.status(400).json({ success: false, message: 'Enter a valid name, category, description, price, and availability.' });
      return;
    }
    if (request.file && request.body.removeImage === 'true') {
      response.status(400).json({ success: false, message: 'Choose an image or remove an image, not both.' });
      return;
    }

    try {
      const vendorResult = await pool.query(
        'SELECT id, name FROM vendors WHERE owner_user_id = $1',
        [request.user.id],
      );
      const vendor = vendorResult.rows[0];
      if (!vendor) {
        response.status(403).json({ success: false, message: 'Your vendor profile is not available.' });
        return;
      }

      const id = randomUUID();
      await pool.query(
        `INSERT INTO menu_items
          (id, vendor_id, name, price_cents, category, description, available, image_mime_type, image_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, vendor.id, item.name, item.priceCents, item.category, item.description, item.available,
          request.file?.mimetype ?? null, request.file?.buffer ?? null],
      );
      response.status(201).json({
        success: true,
        item: {
          id,
          vendorId: vendor.id,
          vendor: vendor.name,
          ...item,
          imageUrl: request.file ? vendorMenuImageUrl(id) : null,
        },
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to add this menu item right now.' });
    }
  });

  app.patch('/api/vendor/menu/:itemId', requireRole('vendor'), parseMenuImage, async (request, response) => {
    const item = validateMenuItem(request.body);
    if (!item) {
      response.status(400).json({ success: false, message: 'Enter a valid name, category, description, price, and availability.' });
      return;
    }
    if (request.file && request.body.removeImage === 'true') {
      response.status(400).json({ success: false, message: 'Choose an image or remove the current image, not both.' });
      return;
    }
    const removeImage = request.body.removeImage === true || request.body.removeImage === 'true';

    try {
      const result = await pool.query(
        `UPDATE menu_items m
            SET name = $1, category = $2, description = $3,
                price_cents = $4, available = $5,
                image_mime_type = CASE WHEN $6 THEN NULL WHEN $7::text IS NOT NULL THEN $7 ELSE m.image_mime_type END,
                image_data = CASE WHEN $6 THEN NULL WHEN $8::bytea IS NOT NULL THEN $8 ELSE m.image_data END
           FROM vendors v
          WHERE m.id = $9 AND m.vendor_id = v.id AND v.owner_user_id = $10
          RETURNING m.id, m.vendor_id, v.name AS vendor, m.name, m.category,
                    m.description, m.price_cents, m.available, m.image_mime_type`,
        [item.name, item.category, item.description, item.priceCents, item.available,
          removeImage, request.file?.mimetype ?? null, request.file?.buffer ?? null,
          request.params.itemId, request.user.id],
      );
      if (!result.rows[0]) {
        response.status(404).json({ success: false, message: 'Menu item not found in your menu.' });
        return;
      }

      const updated = result.rows[0];
      response.json({
        success: true,
        item: {
          id: updated.id,
          vendorId: updated.vendor_id,
          vendor: updated.vendor,
          name: updated.name,
          category: updated.category,
          description: updated.description,
          priceCents: updated.price_cents,
          available: updated.available,
          imageUrl: updated.image_mime_type ? vendorMenuImageUrl(updated.id) : null,
        },
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to update this menu item right now.' });
    }
  });

  app.delete('/api/vendor/menu/:itemId', requireRole('vendor'), async (request, response) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const itemResult = await client.query(
        `SELECT m.id
           FROM menu_items m
           JOIN vendors v ON v.id = m.vendor_id
          WHERE m.id = $1 AND v.owner_user_id = $2
          FOR UPDATE OF m`,
        [request.params.itemId, request.user.id],
      );
      if (!itemResult.rows[0]) {
        await client.query('ROLLBACK');
        response.status(404).json({ success: false, message: 'Menu item not found in your menu.' });
        return;
      }

      const itemId = itemResult.rows[0].id;
      const orderUsage = await client.query(
        'SELECT EXISTS (SELECT 1 FROM order_items WHERE menu_item_id = $1) AS is_referenced',
        [itemId],
      );
      if (orderUsage.rows[0].is_referenced) {
        await client.query('UPDATE menu_items SET available = FALSE WHERE id = $1', [itemId]);
        await client.query('COMMIT');
        response.json({ success: true, retired: true, message: 'This item is in order history, so it was marked unavailable instead of deleted.' });
        return;
      }

      await client.query('DELETE FROM menu_items WHERE id = $1', [itemId]);
      await client.query('COMMIT');
      response.json({ success: true, retired: false, message: 'Menu item deleted.' });
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      response.status(500).json({ success: false, message: 'Unable to remove this menu item right now.' });
    } finally {
      client.release();
    }
  });

  app.get('/api/collection-slots', async (request, response) => {
    const vendorId = typeof request.query.vendorId === 'string' ? request.query.vendorId : '';
    if (!vendorId) {
      response.status(400).json({ success: false, message: 'Choose a vendor before selecting a collection time.' });
      return;
    }
    try {
      await ensureCollectionSlots(pool, vendorId);
      const result = await pool.query(
        `SELECT id, starts_at, capacity - reserved AS remaining
           FROM collection_slots
          WHERE vendor_id = $1 AND starts_at > NOW() AND reserved < capacity
          ORDER BY starts_at LIMIT 24`,
        [vendorId],
      );
      response.json({
        success: true,
        slots: result.rows.map((slot) => ({
          id: slot.id,
          startsAt: new Date(slot.starts_at).toISOString(),
          remaining: slot.remaining,
        })),
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load collection times right now.' });
    }
  });

  app.get('/api/student/orders', requireRole('student'), async (request, response) => {
    try {
      const result = await pool.query(
        'SELECT id FROM orders WHERE student_id = $1 ORDER BY created_at DESC',
        [request.user.id],
      );
      const orders = await Promise.all(result.rows.map(({ id }) => loadOrder(pool, id)));
      response.json({ success: true, orders, firstOrderDiscountEligible: orders.length === 0 });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load your orders right now.' });
    }
  });

  app.post('/api/student/orders', requireRole('student'), async (request, response) => {
    const { items, collectionSlotId, idempotencyKey } = request.body;
    if (
      !Array.isArray(items) || items.length === 0 || items.length > 20 ||
      !items.every((item) => item && typeof item.menuItemId === 'string' &&
        Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20) ||
      !collectionSlotId || !idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > 80
    ) {
      response.status(400).json({ success: false, message: 'Choose menu items and a collection time to place your order.' });
      return;
    }

    const normalizedItems = [...items]
      .map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
      .sort((left, right) => left.menuItemId.localeCompare(right.menuItemId));
    if (new Set(normalizedItems.map((item) => item.menuItemId)).size !== normalizedItems.length) {
      response.status(400).json({ success: false, message: 'Each menu item can only appear once in the order.' });
      return;
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ items: normalizedItems, collectionSlotId }))
      .digest('hex');

    const client = await pool.connect();
    let orderId = '';
    let wasCreated = false;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [request.user.id]);
      const existing = await client.query(
        'SELECT id, request_hash FROM orders WHERE student_id = $1 AND idempotency_key = $2',
        [request.user.id, idempotencyKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== requestHash) {
          await client.query('ROLLBACK');
          response.status(409).json({ success: false, message: 'This order request was already used. Refresh checkout and try again.' });
          return;
        }
        orderId = existing.rows[0].id;
        await client.query('COMMIT');
      } else {
        const menuResult = await client.query(
          `SELECT id, vendor_id, name, price_cents
             FROM menu_items
            WHERE id = ANY($1::text[]) AND available = TRUE
            FOR UPDATE`,
          [normalizedItems.map((item) => item.menuItemId)],
        );
        if (menuResult.rows.length !== normalizedItems.length) {
          await client.query('ROLLBACK');
          response.status(409).json({ success: false, message: 'One or more selected items are no longer available.' });
          return;
        }
        const vendorIds = new Set(menuResult.rows.map((item) => item.vendor_id));
        if (vendorIds.size !== 1) {
          await client.query('ROLLBACK');
          response.status(400).json({ success: false, message: 'Place separate orders for items from different vendors.' });
          return;
        }

        const vendorId = menuResult.rows[0].vendor_id;
        const slotResult = await client.query(
          `SELECT id FROM collection_slots
            WHERE id = $1 AND vendor_id = $2 AND starts_at > NOW() AND reserved < capacity
            FOR UPDATE`,
          [collectionSlotId, vendorId],
        );
        if (!slotResult.rows[0]) {
          await client.query('ROLLBACK');
          response.status(409).json({ success: false, message: 'That collection time is no longer available. Choose another time.' });
          return;
        }

        const menuById = new Map(menuResult.rows.map((item) => [item.id, item]));
        const orderItems = normalizedItems.map((item) => {
          const menuItem = menuById.get(item.menuItemId);
          return {
            ...item,
            name: menuItem.name,
            unitPriceCents: menuItem.price_cents,
            lineTotalCents: menuItem.price_cents * item.quantity,
          };
        });
        const subtotalCents = orderItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
        const previousOrders = await client.query(
          'SELECT EXISTS (SELECT 1 FROM orders WHERE student_id = $1) AS has_previous_order',
          [request.user.id],
        );
        const discountCents = previousOrders.rows[0].has_previous_order
          ? 0
          : Math.round((subtotalCents * FIRST_ORDER_DISCOUNT_PERCENT) / 100);
        const totalCents = subtotalCents - discountCents + SERVICE_FEE_CENTS;
        orderId = randomUUID();
        const orderNumber = `CE-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

        await client.query(
          `INSERT INTO orders
            (id, order_number, student_id, vendor_id, collection_slot_id,
             subtotal_cents, discount_cents, service_fee_cents, total_cents,
             status, idempotency_key, request_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10, $11)`,
          [orderId, orderNumber, request.user.id, vendorId, collectionSlotId,
            subtotalCents, discountCents, SERVICE_FEE_CENTS, totalCents, idempotencyKey, requestHash],
        );
        for (const item of orderItems) {
          await client.query(
            `INSERT INTO order_items
              (id, order_id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [randomUUID(), orderId, item.menuItemId, item.name, item.unitPriceCents, item.quantity, item.lineTotalCents],
          );
        }
        await client.query(
          'UPDATE collection_slots SET reserved = reserved + 1 WHERE id = $1',
          [collectionSlotId],
        );
        await client.query(
          `INSERT INTO order_status_history (id, order_id, status, changed_by)
           VALUES ($1, $2, 'Pending', $3)`,
          [randomUUID(), orderId, request.user.id],
        );
        await client.query('COMMIT');
        wasCreated = true;
      }
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      response.status(500).json({ success: false, message: 'Unable to place your order right now. Your discount has not been used.' });
      return;
    } finally {
      client.release();
    }

    const order = await loadOrder(pool, orderId);
    response.status(wasCreated ? 201 : 200).json({ success: true, order });
  });

  app.get('/api/vendor/orders', requireRole('vendor'), async (request, response) => {
    try {
      const vendorResult = await pool.query('SELECT id FROM vendors WHERE owner_user_id = $1', [request.user.id]);
      if (!vendorResult.rows[0]) {
        response.status(403).json({ success: false, message: 'Your vendor profile is not available.' });
        return;
      }
      const result = await pool.query(
        'SELECT id FROM orders WHERE vendor_id = $1 ORDER BY created_at DESC',
        [vendorResult.rows[0].id],
      );
      const orders = await Promise.all(result.rows.map(({ id }) => loadOrder(pool, id)));
      response.json({ success: true, orders });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load incoming orders right now.' });
    }
  });

  app.patch('/api/vendor/orders/:orderId/status', requireRole('vendor'), async (request, response) => {
    const nextStatus = request.body.status;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT o.id, o.status FROM orders o
           JOIN vendors v ON v.id = o.vendor_id
          WHERE o.order_number = $1 AND v.owner_user_id = $2
          FOR UPDATE OF o`,
        [request.params.orderId, request.user.id],
      );
      const order = result.rows[0];
      if (!order) {
        await client.query('ROLLBACK');
        response.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }
      if (!allowedTransitions[order.status]?.includes(nextStatus)) {
        await client.query('ROLLBACK');
        response.status(400).json({ success: false, message: 'That order status change is not allowed.' });
        return;
      }
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, order.id]);
      await client.query(
        'INSERT INTO order_status_history (id, order_id, status, changed_by) VALUES ($1, $2, $3, $4)',
        [randomUUID(), order.id, nextStatus, request.user.id],
      );
      await client.query('COMMIT');
      response.json({ success: true, order: await loadOrder(pool, order.id) });
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      response.status(500).json({ success: false, message: 'Unable to update this order right now.' });
    } finally {
      client.release();
    }
  });

  app.get('/', (request, response) => {
    response.send('Server is running!');
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    response.status(500).json({ success: false, message: 'The request could not be completed.' });
  });

  return app;
}

module.exports = { createApp, hashPassword, verifyPassword };