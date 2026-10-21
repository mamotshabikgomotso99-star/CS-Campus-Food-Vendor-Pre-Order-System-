const { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const cors = require('cors');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const multer = require('multer');
const { ensureCollectionSlots } = require('./database');
const { createSmtpMailer, createSmtpVerificationMailer } = require('./email');
const { buildCheckoutReturnUrls, createStripeClient, getClientOrigin } = require('./payments');

const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = 'campus_eats_session';
const SERVICE_FEE_CENTS = 500;
const FIRST_ORDER_DISCOUNT_PERCENT = 20;
const MAX_MENU_IMAGE_BYTES = 2 * 1024 * 1024;
const TUT_SOSHANGUVE_SOUTH_BOUNDS = {
  minLatitude: -25.5470054,
  maxLatitude: -25.5340617,
  minLongitude: 28.0906443,
  maxLongitude: 28.0999382,
};
const TUT_SOSHANGUVE_SOUTH_BOUNDARY = [
  [-25.5340617, 28.0953824],
  [-25.5364808, 28.0998952],
  [-25.5365776, 28.0999382],
  [-25.5391563, 28.0985373],
  [-25.5399930, 28.0981763],
  [-25.5403570, 28.0979286],
  [-25.5406253, 28.0976242],
  [-25.5409765, 28.0976101],
  [-25.5411298, 28.0977941],
  [-25.5438250, 28.0968244],
  [-25.5438888, 28.0967182],
  [-25.5441060, 28.0966262],
  [-25.5442656, 28.0966616],
  [-25.5454791, 28.0960953],
  [-25.5469415, 28.0951326],
  [-25.5470054, 28.0948070],
  [-25.5458431, 28.0934409],
  [-25.5446169, 28.0921739],
  [-25.5440421, 28.0928392],
  [-25.5414515, 28.0906443],
];

function isWithinTutSoshanguveSouth(latitude, longitude) {
  let isInside = false;
  for (
    let currentIndex = 0, previousIndex = TUT_SOSHANGUVE_SOUTH_BOUNDARY.length - 1;
    currentIndex < TUT_SOSHANGUVE_SOUTH_BOUNDARY.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const [currentLatitude, currentLongitude] = TUT_SOSHANGUVE_SOUTH_BOUNDARY[currentIndex];
    const [previousLatitude, previousLongitude] = TUT_SOSHANGUVE_SOUTH_BOUNDARY[previousIndex];
    const crossesRay =
      (currentLongitude > longitude) !== (previousLongitude > longitude) &&
      latitude < ((previousLatitude - currentLatitude) * (longitude - currentLongitude)) /
        (previousLongitude - currentLongitude) + currentLatitude;
    if (crossesRay) isInside = !isInside;
  }
  return isInside;
}
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
  Pending: ['Confirmed'],
  Confirmed: ['Preparing'],
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

async function hasVendorProfile(pool, userId) {
  const result = await pool.query('SELECT id FROM vendors WHERE owner_user_id = $1', [userId]);
  return Boolean(result.rows[0]);
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

function getCookieOptions() {
  const clientUrl = process.env.CLIENT_URL ?? '';
  const isCrossSiteClient = Boolean(clientUrl) && /^https?:\/\//i.test(clientUrl) && !/localhost|127\.0\.0\.1/i.test(clientUrl);
  const sameSite = isCrossSiteClient ? 'None' : 'Lax';
  const secure = sameSite === 'None' || process.env.NODE_ENV === 'production';
  return { sameSite, secure };
}

function setSessionCookie(response, token, maxAgeSeconds) {
  const { sameSite, secure } = getCookieOptions();
  const cookieParts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    cookieParts.push('Secure');
  }
  response.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearSessionCookie(response) {
  const { sameSite, secure } = getCookieOptions();
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=0${secure ? '; Secure' : ''}`,
  );
}

function normalizeOrigin(origin) {
  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:') {
      return parsedOrigin.origin;
    }
  } catch {
    return origin.replace(/\/+$/, '');
  }
  return origin.replace(/\/+$/, '');
}

function getAllowedOrigins() {
  const configured = (process.env.CLIENT_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .map(normalizeOrigin)
    .filter(Boolean);
  const vercelHosts = ['.vercel.app', '.vercel-preview.com'];
  const localOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const origins = new Set([...configured, ...localOrigins]);

  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  return {
    origins,
    allowsVercelPreview(origin) {
      if (!origin) {
        return false;
      }
      try {
        const hostname = new URL(origin).hostname;
        return vercelHosts.some((host) => hostname.endsWith(host));
      } catch {
        return false;
      }
    },
  };
}

function orderSummary(items) {
  return items.map((item) => `${item.name} x${item.quantity}`).join(', ');
}

async function loadOrder(pool, orderId) {
  const result = await pool.query(
    `SELECT o.id, o.order_number, o.vendor_id, v.name AS vendor_name,
            o.student_id, u.full_name AS student_name,
            o.subtotal_cents, o.discount_cents, o.service_fee_cents, o.total_cents,
              o.status, o.created_at, s.starts_at AS collection_at,
              p.id AS payment_id, p.status AS payment_status
       FROM orders o
       JOIN vendors v ON v.id = o.vendor_id
       JOIN users u ON u.id = o.student_id
       JOIN collection_slots s ON s.id = o.collection_slot_id
            LEFT JOIN order_payments p ON p.order_id = o.id
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
    paymentId: row.payment_id ?? null,
    paymentStatus: row.payment_status ?? 'unverified',
    collectionAt: new Date(row.collection_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function processStripeWebhookEvent(pool, event) {
  const supportedEvents = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
  ]);
  if (!supportedEvents.has(event.type)) {
    return;
  }

  const session = event.data?.object;
  const paymentId = session?.metadata?.paymentId;
  const orderId = session?.metadata?.orderId;
  if (!session?.id || !paymentId || !orderId || !Number.isSafeInteger(session.amount_total)) {
    throw new Error('Invalid Stripe Checkout event.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertedEvent = await client.query(
      `INSERT INTO stripe_webhook_events (event_id, event_type)
       VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [event.id, event.type],
    );
    if (!insertedEvent.rows[0]) {
      await client.query('COMMIT');
      return;
    }

    const paymentResult = await client.query(
      `SELECT p.id, p.order_id, p.checkout_session_id, p.amount_cents, p.currency,
              p.status AS payment_status, p.slot_released_at,
              o.status AS order_status, o.collection_slot_id
         FROM order_payments p
         JOIN orders o ON o.id = p.order_id
        WHERE p.id = $1 AND o.id = $2
        FOR UPDATE OF p, o`,
      [paymentId, orderId],
    );
    const payment = paymentResult.rows[0];
    if (
      !payment || payment.checkout_session_id !== session.id ||
      payment.amount_cents !== session.amount_total || payment.currency !== session.currency
    ) {
      throw new Error('Stripe Checkout event does not match a pending payment.');
    }

    if (
      event.type !== 'checkout.session.expired' &&
      session.status === 'complete' && session.payment_status === 'paid' &&
      payment.payment_status === 'pending'
    ) {
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
      await client.query(
        `UPDATE order_payments
            SET status = 'paid', payment_intent_id = $1, paid_at = NOW(), updated_at = NOW()
          WHERE id = $2 AND status = 'pending'`,
        [paymentIntentId, payment.id],
      );
    } else if (
      (event.type === 'checkout.session.expired' && session.status === 'expired' ||
        event.type === 'checkout.session.async_payment_failed' && session.status === 'complete') &&
      payment.payment_status === 'pending'
    ) {
      const paymentStatus = event.type === 'checkout.session.expired' ? 'expired' : 'failed';
      await client.query(
        `UPDATE order_payments
            SET status = $1, slot_released_at = COALESCE(slot_released_at, NOW()), updated_at = NOW()
          WHERE id = $2 AND status = 'pending'`,
        [paymentStatus, payment.id],
      );
      if (!payment.slot_released_at) {
        await client.query(
          'UPDATE collection_slots SET reserved = GREATEST(reserved - 1, 0) WHERE id = $1',
          [payment.collection_slot_id],
        );
      }
      if (payment.order_status === 'Pending') {
        await client.query(
          `UPDATE orders SET status = 'Cancelled', updated_at = NOW() WHERE id = $1 AND status = 'Pending'`,
          [payment.order_id],
        );
        await client.query(
          `INSERT INTO order_status_history (id, order_id, status)
           VALUES ($1, $2, 'Cancelled')`,
          [randomUUID(), payment.order_id],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function createApp(pool, dependencies = {}) {
  const app = express();
  app.set('trust proxy', 1);
  const requiresEmailVerification = process.env.NODE_ENV === 'production' || dependencies.requireEmailVerification === true;
  const sendPasswordResetEmail = Object.hasOwn(dependencies, 'sendPasswordResetEmail')
    ? dependencies.sendPasswordResetEmail
    : createSmtpMailer();
  const sendVerificationEmail = Object.hasOwn(dependencies, 'sendVerificationEmail')
    ? dependencies.sendVerificationEmail
    : createSmtpVerificationMailer();
  const passwordResetClientOrigin = dependencies.passwordResetClientOrigin ?? (process.env.CLIENT_URL ?? '').split(',')[0].trim();
  const verificationClientOrigin = dependencies.verificationClientOrigin ?? (process.env.CLIENT_URL ?? '').split(',')[0].trim();
  const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many reset attempts. Please try again later.' },
  });
  const verificationResendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many verification requests. Please try again later.' },
  });
  const verificationConfirmLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many verification attempts. Please try again later.' },
  });
  const stripeClient = Object.hasOwn(dependencies, 'stripeClient')
    ? dependencies.stripeClient
    : createStripeClient();
  const webhookSecret = dependencies.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  const { origins: allowedOrigins, allowsVercelPreview } = getAllowedOrigins();

  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.has(normalizedOrigin) || allowsVercelPreview(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '64kb' }), async (request, response) => {
    if (!stripeClient || !webhookSecret) {
      response.status(503).json({ success: false, message: 'Stripe webhook processing is not configured.' });
      return;
    }

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        request.body,
        request.get('stripe-signature'),
        webhookSecret,
      );
    } catch {
      response.status(400).json({ success: false, message: 'Invalid Stripe webhook signature.' });
      return;
    }

    try {
      await processStripeWebhookEvent(pool, event);
      response.json({ received: true });
    } catch {
      response.status(400).json({ success: false, message: 'Stripe event could not be matched to a payment.' });
    }
  });

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
      if (user.role === 'vendor' && !(await hasVendorProfile(pool, user.id))) {
        response.status(403).json({ success: false, message: 'Your vendor account is awaiting admin approval.' });
        return;
      }

      request.user = user;
      next();
    } catch {
      response.status(500).json({ success: false, message: 'Unable to verify your session right now.' });
    }
  };

  app.post('/api/vendor-requests', async (request, response) => {
    const fullName = typeof request.body.fullName === 'string' ? request.body.fullName.trim() : '';
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const vendorName = typeof request.body.vendorName === 'string' ? request.body.vendorName.trim() : '';
    const category = typeof request.body.category === 'string' ? request.body.category.trim() : '';
    const collectionLocation = typeof request.body.collectionLocation === 'string' ? request.body.collectionLocation.trim() : '';
    const openingTime = typeof request.body.openingTime === 'string' ? request.body.openingTime : '';
    const closingTime = typeof request.body.closingTime === 'string' ? request.body.closingTime : '';
    const preparationTimeMinutes = Number(request.body.preparationTimeMinutes);
    const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

    if (
      !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 ||
      (request.body.confirmPassword && request.body.confirmPassword !== password) ||
      !vendorName || !category || vendorName.length > 120 || category.length > 80 ||
      !collectionLocation || collectionLocation.length > 200 ||
      !isValidTime(openingTime) || !isValidTime(closingTime) || openingTime >= closingTime ||
      !Number.isInteger(preparationTimeMinutes) || preparationTimeMinutes < 1 || preparationTimeMinutes > 180
    ) {
      response.status(400).json({ success: false, message: 'Provide valid contact, business, and password details.' });
      return;
    }

    try {
      const existingAccount = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingAccount.rows[0]) {
        response.status(409).json({ success: false, message: 'An account with this email already exists.' });
        return;
      }

      const passwordHash = await hashPassword(password);
      await pool.query(
        `INSERT INTO vendor_requests
          (id, full_name, email, password_hash, vendor_name, category, collection_location,
           opening_time, closing_time, preparation_time_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [randomUUID(), fullName, email, passwordHash, vendorName, category, collectionLocation,
          openingTime, closingTime, preparationTimeMinutes],
      );
      response.status(201).json({ success: true, message: 'Vendor request submitted for admin review.' });
    } catch (error) {
      if (error.code === '23505') {
        response.status(409).json({ success: false, message: 'A vendor request for this email is already pending.' });
        return;
      }
      response.status(500).json({ success: false, message: 'Unable to submit your vendor request right now.' });
    }
  });

  app.get('/api/admin/vendor-requests', requireRole('admin'), async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT id, full_name AS "fullName", email, vendor_name AS "vendorName",
          category, collection_location AS "collectionLocation",
          opening_time AS "openingTime", closing_time AS "closingTime",
          preparation_time_minutes AS "preparationTimeMinutes", created_at AS "createdAt"
           FROM vendor_requests WHERE status = 'pending' ORDER BY created_at ASC`,
      );
      response.json({ success: true, requests: result.rows });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load vendor requests right now.' });
    }
  });

  app.patch('/api/admin/vendor-requests/:requestId', requireRole('admin'), async (request, response) => {
    const decision = request.body.status;
    if (decision !== 'approved' && decision !== 'rejected') {
      response.status(400).json({ success: false, message: 'Choose approve or reject for this request.' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const requestResult = await client.query(
        `SELECT id, full_name, email, password_hash, vendor_name, category,
          collection_location, opening_time, closing_time, preparation_time_minutes
           FROM vendor_requests WHERE id = $1 AND status = 'pending' FOR UPDATE`,
        [request.params.requestId],
      );
      const vendorRequest = requestResult.rows[0];
      if (!vendorRequest) {
        await client.query('ROLLBACK');
        response.status(404).json({ success: false, message: 'This pending vendor request was not found.' });
        return;
      }
      if (
        decision === 'approved' &&
        (!vendorRequest.collection_location || !vendorRequest.opening_time || !vendorRequest.closing_time ||
          !Number.isInteger(vendorRequest.preparation_time_minutes))
      ) {
        await client.query('ROLLBACK');
        response.status(409).json({
          success: false,
          message: 'This older request is missing operating details. Ask the vendor to submit a new application.',
        });
        return;
      }

      let vendorId = null;
      if (decision === 'approved') {
        const userId = randomUUID();
        vendorId = randomUUID();
        await client.query(
          `INSERT INTO users (id, full_name, email, password_hash, role)
           VALUES ($1, $2, $3, $4, 'vendor')`,
          [userId, vendorRequest.full_name, vendorRequest.email, vendorRequest.password_hash],
        );
        await client.query(
          `INSERT INTO vendors
            (id, name, category, owner_user_id, collection_location, opening_time, closing_time, preparation_time_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [vendorId, vendorRequest.vendor_name, vendorRequest.category, userId,
            vendorRequest.collection_location, vendorRequest.opening_time,
            vendorRequest.closing_time, vendorRequest.preparation_time_minutes],
        );
      }

      await client.query(
        `UPDATE vendor_requests
            SET status = $1, vendor_id = $2, reviewed_by = $3, reviewed_at = NOW(), password_hash = ''
          WHERE id = $4`,
        [decision, vendorId, request.user.id, vendorRequest.id],
      );
      await client.query('COMMIT');
      response.json({ success: true, message: `Vendor request ${decision}.`, status: decision });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') {
        response.status(409).json({ success: false, message: 'The vendor email or business name is already in use.' });
        return;
      }
      response.status(500).json({ success: false, message: 'Unable to review this vendor request right now.' });
    } finally {
      client.release();
    }
  });

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

  app.post('/api/vendor-requests', async (request, response) => {
    const fullName = typeof request.body.fullName === 'string' ? request.body.fullName.trim() : '';
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const vendorName = typeof request.body.vendorName === 'string' ? request.body.vendorName.trim() : '';
    const category = typeof request.body.category === 'string' ? request.body.category.trim() : '';
    const collectionLocation = typeof request.body.collectionLocation === 'string' ? request.body.collectionLocation.trim() : '';
    const openingTime = typeof request.body.openingTime === 'string' ? request.body.openingTime : '';
    const closingTime = typeof request.body.closingTime === 'string' ? request.body.closingTime : '';
    const preparationTimeMinutes = Number(request.body.preparationTimeMinutes);
    const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

    if (
      !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 ||
      (request.body.confirmPassword && request.body.confirmPassword !== password) ||
      !vendorName || vendorName.length > 120 || !category || category.length > 80 ||
      !collectionLocation || collectionLocation.length > 200 ||
      !isValidTime(openingTime) || !isValidTime(closingTime) || openingTime >= closingTime ||
      !Number.isInteger(preparationTimeMinutes) || preparationTimeMinutes < 1 || preparationTimeMinutes > 180
    ) {
      response.status(400).json({ success: false, message: 'Provide valid contact, business, and operating details.' });
      return;
    }

    try {
      const existingAccount = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingAccount.rows[0]) {
        response.status(409).json({ success: false, message: 'An account with this email already exists.' });
        return;
      }
      const passwordHash = await hashPassword(password);
      await pool.query(
        `INSERT INTO vendor_requests
          (id, full_name, email, password_hash, vendor_name, category, collection_location,
           opening_time, closing_time, preparation_time_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [randomUUID(), fullName, email, passwordHash, vendorName, category, collectionLocation,
          openingTime, closingTime, preparationTimeMinutes],
      );
      response.status(201).json({ success: true, message: 'Vendor request submitted for admin review.' });
    } catch (error) {
      if (error.code === '23505') {
        response.status(409).json({ success: false, message: 'A vendor request for this email is already pending.' });
        return;
      }
      response.status(500).json({ success: false, message: 'Unable to submit your vendor request right now.' });
    }
  });

  app.get('/api/admin/vendor-requests', requireRole('admin'), async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT id, full_name AS "fullName", email, vendor_name AS "vendorName", category,
                collection_location AS "collectionLocation", opening_time AS "openingTime",
                closing_time AS "closingTime", preparation_time_minutes AS "preparationTimeMinutes",
                created_at AS "createdAt"
           FROM vendor_requests WHERE status = 'pending' ORDER BY created_at ASC`,
      );
      response.json({ success: true, requests: result.rows });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load vendor requests right now.' });
    }
  });

  app.get('/api/admin/vendors/locations', requireRole('admin'), async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT id, name, collection_location AS "collectionLocation",
                latitude, longitude
           FROM vendors
          WHERE (owner_user_id IS NOT NULL AND collection_location IS NOT NULL)
             OR id = 'student-cafe'
          ORDER BY name`,
      );
      response.json({ success: true, vendors: result.rows });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load vendor locations right now.' });
    }
  });

  app.patch('/api/admin/vendors/:vendorId/location', requireRole('admin'), async (request, response) => {
    const latitude = request.body.latitude;
    const longitude = request.body.longitude;
    const bounds = TUT_SOSHANGUVE_SOUTH_BOUNDS;
    if (
      typeof latitude !== 'number' || !Number.isFinite(latitude) ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) ||
      latitude < bounds.minLatitude || latitude > bounds.maxLatitude ||
      longitude < bounds.minLongitude || longitude > bounds.maxLongitude ||
      !isWithinTutSoshanguveSouth(latitude, longitude)
    ) {
      response.status(400).json({ success: false, message: 'Choose a valid pin inside TUT Soshanguve South campus.' });
      return;
    }

    try {
      const result = await pool.query(
        `UPDATE vendors
            SET latitude = $1, longitude = $2
          WHERE id = $3
            AND ((owner_user_id IS NOT NULL AND collection_location IS NOT NULL) OR id = 'student-cafe')
          RETURNING id, name, collection_location AS "collectionLocation", latitude, longitude`,
        [latitude, longitude, request.params.vendorId],
      );
      if (!result.rows[0]) {
        response.status(404).json({ success: false, message: 'Approved vendor with a collection point not found.' });
        return;
      }
      response.json({ success: true, vendor: result.rows[0] });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to save the vendor location right now.' });
    }
  });

  app.patch('/api/admin/vendor-requests/:requestId', requireRole('admin'), async (request, response) => {
    const decision = request.body.status;
    if (decision !== 'approved' && decision !== 'rejected') {
      response.status(400).json({ success: false, message: 'Choose approve or reject for this request.' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT id, full_name, email, password_hash, vendor_name, category,
                collection_location, opening_time, closing_time, preparation_time_minutes
           FROM vendor_requests WHERE id = $1 AND status = 'pending' FOR UPDATE`,
        [request.params.requestId],
      );
      const vendorRequest = result.rows[0];
      if (!vendorRequest) {
        await client.query('ROLLBACK');
        response.status(404).json({ success: false, message: 'This pending vendor request was not found.' });
        return;
      }
      if (
        decision === 'approved' &&
        (!vendorRequest.collection_location || !vendorRequest.opening_time || !vendorRequest.closing_time ||
          !Number.isInteger(vendorRequest.preparation_time_minutes))
      ) {
        await client.query('ROLLBACK');
        response.status(409).json({ success: false, message: 'This request is missing required operating details.' });
        return;
      }

      let vendorId = null;
      if (decision === 'approved') {
        const userId = randomUUID();
        vendorId = randomUUID();
        await client.query(
          `INSERT INTO users (id, full_name, email, password_hash, role)
           VALUES ($1, $2, $3, $4, 'vendor')`,
          [userId, vendorRequest.full_name, vendorRequest.email, vendorRequest.password_hash],
        );
        await client.query(
          `INSERT INTO vendors
            (id, name, category, owner_user_id, collection_location, opening_time, closing_time, preparation_time_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [vendorId, vendorRequest.vendor_name, vendorRequest.category, userId,
            vendorRequest.collection_location, vendorRequest.opening_time,
            vendorRequest.closing_time, vendorRequest.preparation_time_minutes],
        );
      }
      await client.query(
        `UPDATE vendor_requests
            SET status = $1, vendor_id = $2, reviewed_by = $3, reviewed_at = NOW(), password_hash = ''
          WHERE id = $4`,
        [decision, vendorId, request.user.id, vendorRequest.id],
      );
      await client.query('COMMIT');
      response.json({ success: true, message: `Vendor request ${decision}.`, status: decision });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') {
        response.status(409).json({ success: false, message: 'The vendor email or business name is already in use.' });
        return;
      }
      response.status(500).json({ success: false, message: 'Unable to review this vendor request right now.' });
    } finally {
      client.release();
    }
  });

  app.post('/api/auth/register', async (request, response) => {
    const fullName = typeof request.body.fullName === 'string' ? request.body.fullName.trim() : '';
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const role = typeof request.body.role === 'string' ? request.body.role : '';
    const studentNumber = typeof request.body.studentNumber === 'string'
      ? request.body.studentNumber.trim() || null
      : null;
    const staffNumber = typeof request.body.staffNumber === 'string'
      ? request.body.staffNumber.trim() || null
      : null;
    const hasAcademicNumber = Boolean(studentNumber || staffNumber);

    if (role && role !== 'student') {
      response.status(400).json({ success: false, message: 'Please provide valid account details.' });
      return;
    }

    if (
      !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !hasAcademicNumber ||
      (request.body.confirmPassword && request.body.confirmPassword !== password)
    ) {
      response.status(400).json({ success: false, message: 'Please provide valid account details.' });
      return;
    }
    if (requiresEmailVerification && (!sendVerificationEmail || !verificationClientOrigin)) {
      response.status(503).json({ success: false, message: 'Email verification is not configured.' });
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
        [userId, fullName, email, passwordHash, 'student', studentNumber || staffNumber],
      );
      const token = randomBytes(32).toString('base64url');
      await client.query(
        `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
        [randomUUID(), userId, hashToken(token)],
      );

      await client.query('COMMIT');
      let verificationSent = false;
      if (sendVerificationEmail && verificationClientOrigin) {
        try {
          const verificationUrl = new URL('/verify-email', verificationClientOrigin);
          verificationUrl.searchParams.set('token', token);
          await sendVerificationEmail(email, verificationUrl.toString());
          verificationSent = true;
        } catch {
          console.error('Email verification delivery failed.');
        }
      }
      response.status(201).json({
        success: true,
        message: verificationSent
          ? 'Account created. Check your email to verify your account.'
          : requiresEmailVerification
            ? 'Account created, but the verification email could not be sent. Request another link to try again.'
            : 'Account created. You can sign in now; the verification email could not be sent.',
        role,
        verificationSent,
        verificationRequired: requiresEmailVerification,
      });

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
        'SELECT id, email, full_name, role, password_hash, email_verified_at FROM users WHERE email = $1',
        [email],
      );
      const user = result.rows[0];
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        response.status(401).json({ success: false, message: 'Invalid email or password.' });
        return;
      }
      if (requiresEmailVerification && user.role === 'student' && !user.email_verified_at) {
        response.status(403).json({
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before signing in.',
        });
        return;
      }

      if (user.role === 'vendor' && !(await hasVendorProfile(pool, user.id))) {
        response.status(403).json({ success: false, message: 'Your vendor account is awaiting admin approval.' });
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

  app.post('/api/auth/forgot-password', passwordResetLimiter, async (request, response) => {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ success: false, message: 'Enter a valid email address.' });
      return;
    }

    if (!sendPasswordResetEmail || !passwordResetClientOrigin) {
      response.status(503).json({ success: false, message: 'Password reset email is not configured.' });
      return;
    }

    try {
      const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (user) {
        const token = randomBytes(32).toString('base64url');
        const tokenHash = hashToken(token);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
          await client.query(
            'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
            [user.id],
          );
          await client.query(
            `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`,
            [randomUUID(), user.id, tokenHash],
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }

        const resetUrl = new URL('/reset-password', passwordResetClientOrigin);
        resetUrl.searchParams.set('token', token);
        try {
          await sendPasswordResetEmail(user.email, resetUrl.toString());
        } catch {
          await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]).catch(() => {});
          console.error('Password reset email delivery failed.');
        }
      }

      response.json({
        success: true,
        message: 'If an account exists for that email, a password reset link will be sent.',
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to process your reset request right now.' });
    }
  });

  app.post('/api/auth/reset-password', passwordResetLimiter, async (request, response) => {
    const token = typeof request.body.token === 'string' ? request.body.token : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const confirmPassword = typeof request.body.confirmPassword === 'string' ? request.body.confirmPassword : '';
    if (!token || password.length < 8 || password !== confirmPassword) {
      response.status(400).json({ success: false, message: 'Provide a valid reset link and matching password of at least 8 characters.' });
      return;
    }

    let client;
    try {
      const passwordHash = await hashPassword(password);
      client = await pool.connect();
      await client.query('BEGIN');
      const tokenResult = await client.query(
        `SELECT id, user_id FROM password_reset_tokens
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
          FOR UPDATE`,
        [hashToken(token)],
      );
      const resetToken = tokenResult.rows[0];
      if (!resetToken) {
        await client.query('ROLLBACK');
        response.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
        return;
      }

      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetToken.user_id]);
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [resetToken.user_id],
      );
      await client.query('DELETE FROM sessions WHERE user_id = $1', [resetToken.user_id]);
      await client.query('COMMIT');
      response.json({ success: true, message: 'Your password has been reset. Sign in with your new password.' });
    } catch {
      if (client) await client.query('ROLLBACK').catch(() => {});
      response.status(500).json({ success: false, message: 'Unable to reset your password right now.' });
    } finally {
      client?.release();
    }
  });

  app.post('/api/auth/verify-email', verificationResendLimiter, async (request, response) => {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ success: false, message: 'Enter a valid email address.' });
      return;
    }
    if (!sendVerificationEmail || !verificationClientOrigin) {
      response.status(503).json({ success: false, message: 'Email verification is not configured.' });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT id FROM users
          WHERE email = $1 AND role = 'student' AND email_verified_at IS NULL`,
        [email],
      );
      const user = result.rows[0];
      if (user) {
        const client = await pool.connect();
        let token;
        try {
          await client.query('BEGIN');
          await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
          await client.query(
            'DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL',
            [user.id],
          );
          token = randomBytes(32).toString('base64url');
          await client.query(
            `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
            [randomUUID(), user.id, hashToken(token)],
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }

        const verificationUrl = new URL('/verify-email', verificationClientOrigin);
        verificationUrl.searchParams.set('token', token);
        try {
          await sendVerificationEmail(email, verificationUrl.toString());
        } catch {
          console.error('Email verification delivery failed.');
        }
      }

      response.json({
        success: true,
        message: 'If an unverified student account exists for that email, a verification link will be sent.',
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to process your verification request right now.' });
    }
  });

  app.post('/api/auth/confirm-email', verificationConfirmLimiter, async (request, response) => {
    const token = typeof request.body.token === 'string' ? request.body.token : '';
    if (!token) {
      response.status(400).json({ success: false, message: 'Provide a valid verification link.' });
      return;
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT id, user_id FROM email_verification_tokens
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
          FOR UPDATE`,
        [hashToken(token)],
      );
      const verificationToken = result.rows[0];
      if (!verificationToken) {
        await client.query('ROLLBACK');
        response.status(400).json({ success: false, message: 'This verification link is invalid or has expired.' });
        return;
      }

      await client.query(
        'UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1 AND role = $2',
        [verificationToken.user_id, 'student'],
      );
      await client.query(
        'UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [verificationToken.user_id],
      );
      await client.query('COMMIT');
      response.json({ success: true, message: 'Email verified. You can now sign in.' });
    } catch {
      if (client) await client.query('ROLLBACK').catch(() => {});
      response.status(500).json({ success: false, message: 'Unable to verify your email right now.' });
    } finally {
      client?.release();
    }
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
        `SELECT m.id, m.name, m.vendor_id, v.name AS vendor,
          v.collection_location, v.latitude, v.longitude, m.price_cents,
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
          collectionLocation: item.collection_location,
          latitude: item.latitude,
          longitude: item.longitude,
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
      const paymentResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM orders o
           LEFT JOIN order_payments p ON p.order_id = o.id
            WHERE o.student_id = $1
              AND (p.status = 'paid' OR (p.id IS NULL AND o.discount_cents > 0))
         ) AS has_used_first_order_discount`,
        [request.user.id],
      );
      response.json({
        success: true,
        orders,
        firstOrderDiscountEligible: !paymentResult.rows[0].has_used_first_order_discount,
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load your orders right now.' });
    }
  });

  app.post('/api/student/orders', requireRole('student'), (request, response) => {
    response.status(410).json({ success: false, message: 'Use online checkout to place an order.' });
  });

  app.post(
    ['/api/payments/create-checkout-session', '/api/student/payments/checkout'],
    requireRole('student'),
    async (request, response) => {
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

    if (!stripeClient || !webhookSecret) {
      response.status(503).json({ success: false, message: 'Online payments are not configured. Set the Stripe test key and webhook secret on the API server.' });
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

    try {
      getClientOrigin(process.env.CLIENT_URL);
    } catch {
      response.status(503).json({ success: false, message: 'Set a valid CLIENT_URL on the API server before accepting online payments.' });
      return;
    }

    const client = await pool.connect();
    let checkout = null;
    let wasCreated = false;
    try {
      await client.query('BEGIN');
      const studentResult = await client.query(
        'SELECT id, email FROM users WHERE id = $1 FOR UPDATE',
        [request.user.id],
      );
      const student = studentResult.rows[0];
      const existing = await client.query(
        `SELECT o.id AS order_id, o.order_number, o.request_hash, o.total_cents,
                p.id AS payment_id, p.status AS payment_status, p.checkout_session_id
           FROM orders o JOIN order_payments p ON p.order_id = o.id
          WHERE o.student_id = $1 AND o.idempotency_key = $2
          FOR UPDATE OF o, p`,
        [request.user.id, idempotencyKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== requestHash) {
          throw Object.assign(new Error('This order request was already used. Refresh checkout and try again.'), { status: 409 });
        }
        if (existing.rows[0].payment_status !== 'pending' && existing.rows[0].payment_status !== 'paid') {
          throw Object.assign(new Error('This payment attempt has ended. Start a new checkout to try again.'), { status: 409 });
        }
        if (existing.rows[0].payment_status === 'paid') {
          await client.query('COMMIT');
          response.json({
            success: true,
            paymentId: existing.rows[0].payment_id,
            orderId: existing.rows[0].order_id,
            paymentStatus: 'paid',
            checkoutUrl: null,
          });
          return;
        }
        checkout = {
          paymentId: existing.rows[0].payment_id,
          orderId: existing.rows[0].order_id,
          orderNumber: existing.rows[0].order_number,
          totalCents: existing.rows[0].total_cents,
          checkoutSessionId: existing.rows[0].checkout_session_id,
          email: student.email,
        };
        await client.query('COMMIT');
      } else {
        const pendingPayment = await client.query(
          `SELECT p.id AS payment_id, p.status AS payment_status, p.checkout_session_id,
                  o.id AS order_id, o.order_number, o.total_cents, o.request_hash
             FROM order_payments p JOIN orders o ON o.id = p.order_id
            WHERE o.student_id = $1 AND p.status = 'pending'
            LIMIT 1 FOR UPDATE OF p`,
          [request.user.id],
        );
        if (pendingPayment.rows[0]) {
          if (pendingPayment.rows[0].request_hash !== requestHash) {
            throw Object.assign(new Error('Finish or resume your pending payment before starting another order.'), { status: 409 });
          }
          checkout = {
            paymentId: pendingPayment.rows[0].payment_id,
            orderId: pendingPayment.rows[0].order_id,
            orderNumber: pendingPayment.rows[0].order_number,
            totalCents: pendingPayment.rows[0].total_cents,
            checkoutSessionId: pendingPayment.rows[0].checkout_session_id,
            email: student.email,
          };
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
           `SELECT EXISTS (
             SELECT 1 FROM orders o
             LEFT JOIN order_payments p ON p.order_id = o.id
              WHERE o.student_id = $1
               AND (p.status = 'paid' OR (p.id IS NULL AND o.discount_cents > 0))
            ) AS has_previous_order`,
          [request.user.id],
        );
        const discountCents = previousOrders.rows[0].has_previous_order
          ? 0
          : Math.round((subtotalCents * FIRST_ORDER_DISCOUNT_PERCENT) / 100);
        const totalCents = subtotalCents - discountCents + SERVICE_FEE_CENTS;
        const orderId = randomUUID();
        const paymentId = randomUUID();
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
          `INSERT INTO order_payments
            (id, order_id, provider, amount_cents, currency, status)
           VALUES ($1, $2, 'stripe', $3, 'zar', 'pending')`,
          [paymentId, orderId, totalCents],
        );
        await client.query(
          `INSERT INTO order_status_history (id, order_id, status, changed_by)
           VALUES ($1, $2, 'Pending', $3)`,
          [randomUUID(), orderId, request.user.id],
        );
        await client.query('COMMIT');
        checkout = { paymentId, orderId, orderNumber, totalCents, checkoutSessionId: null, email: student.email };
        wasCreated = true;
        }
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      response.status(error.status ?? 500).json({
        success: false,
        message: error.status ? error.message : 'Unable to start online checkout right now.',
      });
      return;
    } finally {
      client.release();
    }

    try {
      let session;
      if (checkout.checkoutSessionId) {
        session = await stripeClient.checkout.sessions.retrieve(checkout.checkoutSessionId);
        if (session.status === 'expired') {
          response.status(409).json({ success: false, message: 'This checkout session expired. Wait for its status to update, then start a new order.' });
          return;
        }
        if (session.status === 'complete') {
          response.status(202).json({
            success: true,
            paymentId: checkout.paymentId,
            orderId: checkout.orderId,
            paymentStatus: 'pending',
            checkoutUrl: null,
          });
          return;
        }
      } else {
        const urls = buildCheckoutReturnUrls(checkout.paymentId, process.env.CLIENT_URL);
        session = await stripeClient.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: checkout.email,
          client_reference_id: checkout.paymentId,
          line_items: [{
            price_data: {
              currency: 'zar',
              unit_amount: checkout.totalCents,
              product_data: { name: `Campus Eats order ${checkout.orderNumber}` },
            },
            quantity: 1,
          }],
          metadata: { paymentId: checkout.paymentId, orderId: checkout.orderId },
          payment_intent_data: { metadata: { paymentId: checkout.paymentId, orderId: checkout.orderId } },
          success_url: urls.successUrl,
          cancel_url: urls.cancelUrl,
        }, { idempotencyKey: `campuseats-${checkout.paymentId}` });

        if (!session.url) {
          throw new Error('Stripe did not return a Checkout URL.');
        }
        await pool.query(
          `UPDATE order_payments SET checkout_session_id = $1, updated_at = NOW()
            WHERE id = $2 AND status = 'pending'`,
          [session.id, checkout.paymentId],
        );
      }

      response.status(wasCreated ? 201 : 200).json({
        success: true,
        paymentId: checkout.paymentId,
        orderId: checkout.orderId,
        paymentStatus: 'pending',
        checkoutUrl: session.status === 'open' ? session.url : null,
      });
    } catch {
      response.status(502).json({ success: false, message: 'Unable to start Stripe Checkout. Retry safely or contact support.' });
    }
  });

  app.get('/api/student/payments/:paymentId', requireRole('student'), async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.status, p.checkout_session_id, p.order_id
           FROM order_payments p JOIN orders o ON o.id = p.order_id
          WHERE p.id = $1 AND o.student_id = $2`,
        [request.params.paymentId, request.user.id],
      );
      const payment = result.rows[0];
      if (!payment) {
        response.status(404).json({ success: false, message: 'Payment not found.' });
        return;
      }

      let checkoutUrl = null;
      if (payment.status === 'pending' && payment.checkout_session_id && stripeClient) {
        try {
          const session = await stripeClient.checkout.sessions.retrieve(payment.checkout_session_id);
          if (session.status === 'open') checkoutUrl = session.url;
        } catch {
          checkoutUrl = null;
        }
      }
      response.json({
        success: true,
        paymentId: payment.id,
        paymentStatus: payment.status,
        checkoutUrl,
        order: await loadOrder(pool, payment.order_id),
      });
    } catch {
      response.status(500).json({ success: false, message: 'Unable to load this payment right now.' });
    }
  });

  app.get('/api/vendor/orders', requireRole('vendor'), async (request, response) => {
    try {
      const vendorResult = await pool.query('SELECT id FROM vendors WHERE owner_user_id = $1', [request.user.id]);
      if (!vendorResult.rows[0]) {
        response.status(403).json({ success: false, message: 'Your vendor profile is not available.' });
        return;
      }
      const result = await pool.query(
        `SELECT o.id FROM orders o
           JOIN order_payments p ON p.order_id = o.id AND p.status = 'paid'
          WHERE o.vendor_id = $1 ORDER BY o.created_at DESC`,
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
          JOIN order_payments p ON p.order_id = o.id AND p.status = 'paid'
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