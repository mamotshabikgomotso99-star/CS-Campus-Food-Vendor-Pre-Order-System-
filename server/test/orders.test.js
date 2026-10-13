const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { deflateSync } = require('node:zlib');
const Stripe = require('stripe');

const envPath = path.join(__dirname, '..', '.env');
if (process.loadEnvFile && fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Tests can still use environment variables supplied by the runner.
  }
}

const { createApp } = require('../app');
const { createPool, initializeDatabase } = require('../database');
const { createVendorLogin } = require('../vendor-provisioning');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createPngPixel(red, green, blue) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = deflateSync(Buffer.from([0, red, green, blue, 255]));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', pixels),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test('first-order discount is server-owned, one-time, and account-specific', {
  skip: !process.env.DATABASE_URL,
}, async (context) => {
  const pool = createPool();
  await initializeDatabase(pool);
  const stripeSdk = new Stripe('sk_test_campus_eats');
  const stripeWebhookSecret = 'whsec_campus_eats_test';
  const stripeSessions = new Map();
  const stripeEventIds = [];
  let stripeSessionCount = 0;
  const stripeClient = {
    checkout: {
      sessions: {
        async create(parameters) {
          stripeSessionCount += 1;
          const id = `cs_test_${stripeSessionCount}`;
          const session = {
            id,
            url: `https://checkout.stripe.test/${id}`,
            status: 'open',
            payment_status: 'unpaid',
            amount_total: parameters.line_items[0].price_data.unit_amount,
            currency: parameters.line_items[0].price_data.currency,
            metadata: parameters.metadata,
            payment_intent: null,
          };
          stripeSessions.set(id, session);
          return session;
        },
        async retrieve(sessionId) {
          return stripeSessions.get(sessionId);
        },
      },
    },
    webhooks: {
      constructEvent: (...args) => stripeSdk.webhooks.constructEvent(...args),
    },
  };
  const server = createApp(pool, { stripeClient, webhookSecret: stripeWebhookSecret }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const uniqueId = randomUUID();
  const accounts = [
    { email: `order-test-${uniqueId}@example.invalid`, studentNumber: `test-${uniqueId}` },
    { email: `order-test-second-${uniqueId}@example.invalid`, studentNumber: `test-second-${uniqueId}` },
    { email: `order-test-concurrent-${uniqueId}@example.invalid`, studentNumber: `test-concurrent-${uniqueId}` },
    { email: `order-test-legacy-${uniqueId}@example.invalid`, studentNumber: `test-legacy-${uniqueId}` },
  ];
  const vendorAccount = {
    vendorId: `order-test-vendor-${uniqueId}`,
    email: `order-test-vendor-${uniqueId}@example.invalid`,
    vendorName: `Order Test Vendor ${uniqueId}`,
  };
  const otherVendorAccount = {
    vendorId: `order-test-other-vendor-${uniqueId}`,
    email: `order-test-other-vendor-${uniqueId}@example.invalid`,
    vendorName: `Other Order Test Vendor ${uniqueId}`,
  };
  const vendorIds = [vendorAccount.vendorId, otherVendorAccount.vendorId];

  context.after(async () => {
    try {
      const emailList = [...accounts.map((account) => account.email), vendorAccount.email, otherVendorAccount.email];
      await pool.query('BEGIN');
      await pool.query(
        `UPDATE collection_slots slot
            SET reserved = GREATEST(0, slot.reserved - order_counts.count)
           FROM (
             SELECT collection_slot_id, COUNT(*)::INTEGER AS count
               FROM orders o
              WHERE student_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))
                AND NOT EXISTS (
                  SELECT 1 FROM order_payments p
                   WHERE p.order_id = o.id AND p.slot_released_at IS NOT NULL
                )
              GROUP BY collection_slot_id
           ) order_counts
          WHERE slot.id = order_counts.collection_slot_id`,
        [emailList],
      );
      await pool.query(
        `DELETE FROM order_status_history WHERE order_id IN (
           SELECT id FROM orders WHERE student_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))
         )`,
        [emailList],
      );
      if (stripeEventIds.length > 0) {
        await pool.query('DELETE FROM stripe_webhook_events WHERE event_id = ANY($1::text[])', [stripeEventIds]);
      }
      await pool.query(
        `DELETE FROM order_items WHERE order_id IN (
           SELECT id FROM orders WHERE student_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))
         )`,
        [emailList],
      );
      await pool.query(
        'DELETE FROM orders WHERE student_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))',
        [emailList],
      );
      await pool.query(
        `DELETE FROM menu_items
          WHERE vendor_id = ANY($1::text[])
             OR vendor_id IN (SELECT id FROM vendors WHERE owner_user_id IN (SELECT id FROM users WHERE email = ANY($2::text[])))`,
        [vendorIds, emailList],
      );
      await pool.query(
        `DELETE FROM collection_slots
          WHERE vendor_id = ANY($1::text[])
             OR vendor_id IN (SELECT id FROM vendors WHERE owner_user_id IN (SELECT id FROM users WHERE email = ANY($2::text[])))`,
        [vendorIds, emailList],
      );
      await pool.query(
        `DELETE FROM vendors
          WHERE id = ANY($1::text[])
             OR owner_user_id IN (SELECT id FROM users WHERE email = ANY($2::text[]))`,
        [vendorIds, emailList],
      );
      await pool.query(
        'DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))',
        [emailList],
      );
      await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [emailList]);
      await pool.query('COMMIT');
    } catch {
      await pool.query('ROLLBACK').catch(() => {});
      throw new Error('Unable to clean up API integration test records.');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    }
  });

  const send = async (route, { method = 'GET', payload, cookie } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { response, data: await response.json() };
  };

  const sendStripeEvent = async (type, session, {
    invalidSignature = false,
    eventId = `evt_${randomUUID().replaceAll('-', '')}`,
  } = {}) => {
    const event = { id: eventId, type, data: { object: session } };
    stripeEventIds.push(event.id);
    const rawBody = JSON.stringify(event);
    const signature = stripeSdk.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: invalidSignature ? 'whsec_wrong_secret' : stripeWebhookSecret,
    });
    const response = await fetch(`${baseUrl}/api/payments/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
      body: rawBody,
    });
    return { response, data: await response.json() };
  };

  const completePayment = async (paymentId, options) => {
    const session = [...stripeSessions.values()].find((entry) => entry.metadata.paymentId === paymentId);
    assert.ok(session, 'expected a Stripe Checkout Session');
    session.status = 'complete';
    session.payment_status = 'paid';
    session.payment_intent = `pi_test_${session.id}`;
    return sendStripeEvent('checkout.session.completed', session, options);
  };

  const placePaidOrder = async (cookie, payload) => {
    const checkout = await send('/api/payments/create-checkout-session', {
      method: 'POST', cookie, payload,
    });
    if (checkout.data.paymentStatus === 'pending' && checkout.data.checkoutUrl) {
      const webhook = await completePayment(checkout.data.paymentId);
      assert.equal(webhook.response.status, 200);
    }
    if (!checkout.data.paymentId) return checkout;
    const payment = await send(`/api/student/payments/${checkout.data.paymentId}`, { cookie });
    return { response: checkout.response, data: { ...checkout.data, order: payment.data.order } };
  };

  const sendMultipart = async (route, { method = 'POST', fields = {}, file, cookie } = {}) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, String(value));
    }
    if (file) {
      formData.set('image', new Blob([file.buffer], { type: file.mimeType }), file.name);
    }
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: cookie ? { Cookie: cookie } : {},
      body: formData,
    });
    return { response, data: await response.json() };
  };

  const registerAndLogin = async (account) => {
    const registration = await send('/api/auth/register', {
      method: 'POST',
      payload: {
        fullName: 'Order Test Student',
        email: account.email,
        password: 'test-password-123',
        confirmPassword: 'test-password-123',
        role: 'student',
        studentNumber: account.studentNumber,
      },
    });
    assert.equal(registration.response.status, 201);

    const login = await send('/api/auth/login', {
      method: 'POST',
      payload: { email: account.email, password: 'test-password-123' },
    });
    assert.equal(login.response.status, 200);
    const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    return cookie;
  };

  const registerVendorAndLogin = async (account = vendorAccount) => {
    await pool.query(
      'INSERT INTO vendors (id, name, category) VALUES ($1, $2, $3)',
      [account.vendorId, account.vendorName, 'Test'],
    );
    await createVendorLogin(pool, {
      vendorId: account.vendorId,
      fullName: 'Order Test Vendor',
      email: account.email,
      password: 'test-password-123',
    });

    const login = await send('/api/auth/login', {
      method: 'POST',
      payload: { email: account.email, password: 'test-password-123' },
    });
    assert.equal(login.response.status, 200);
    return login.response.headers.get('set-cookie')?.split(';')[0];
  };

  const firstCookie = await registerAndLogin(accounts[0]);
  const unauthorized = await send('/api/student/orders');
  assert.equal(unauthorized.response.status, 401);
  const legacyCreate = await send('/api/student/orders', {
    method: 'POST', cookie: firstCookie, payload: {},
  });
  assert.equal(legacyCreate.response.status, 410);

  const firstHistory = await send('/api/student/orders', { cookie: firstCookie });
  assert.equal(firstHistory.data.firstOrderDiscountEligible, true);
  assert.deepEqual(firstHistory.data.orders, []);

  const slotResponse = await send('/api/collection-slots?vendorId=fresh-bites');
  assert.ok(slotResponse.data.slots.length >= 2);
  const invalidOrder = await send('/api/student/payments/checkout', {
    method: 'POST',
    cookie: firstCookie,
    payload: {
      items: [{ menuItemId: 'not-a-menu-item', quantity: 1 }],
      collectionSlotId: slotResponse.data.slots[0].id,
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(invalidOrder.response.status, 409);
  const eligibilityAfterFailure = await send('/api/student/orders', { cookie: firstCookie });
  assert.equal(eligibilityAfterFailure.data.firstOrderDiscountEligible, true);

  const firstPayload = {
    items: [{ menuItemId: 'chicken-wrap', quantity: 1, priceCents: 1 }],
    collectionSlotId: slotResponse.data.slots[0].id,
    idempotencyKey: randomUUID(),
  };
  const firstOrder = await placePaidOrder(firstCookie, firstPayload);
  assert.equal(firstOrder.response.status, 201);
  assert.equal(firstOrder.data.order.subtotalCents, 4500);
  assert.equal(firstOrder.data.order.discountCents, 900);
  assert.equal(firstOrder.data.order.serviceFeeCents, 500);
  assert.equal(firstOrder.data.order.totalCents, 4100);
  const firstStripeSession = [...stripeSessions.values()].find((session) => session.metadata.paymentId === firstOrder.data.paymentId);
  assert.equal(firstStripeSession.amount_total, 4100);
  assert.equal(firstStripeSession.currency, 'zar');

  const firstRetry = await placePaidOrder(firstCookie, firstPayload);
  assert.equal(firstRetry.response.status, 200);
  assert.equal(firstRetry.data.order.orderId, firstOrder.data.order.orderId);

  const secondOrder = await placePaidOrder(firstCookie, {
      items: [{ menuItemId: 'chicken-wrap', quantity: 1 }],
      collectionSlotId: slotResponse.data.slots[1].id,
      idempotencyKey: randomUUID(),
  });
  assert.equal(secondOrder.response.status, 201);
  assert.equal(secondOrder.data.order.discountCents, 0);
  assert.equal(secondOrder.data.order.totalCents, 5000);

  const history = await send('/api/student/orders', { cookie: firstCookie });
  assert.equal(history.data.firstOrderDiscountEligible, false);
  assert.equal(history.data.orders.length, 2);

  const secondCookie = await registerAndLogin(accounts[1]);
  const secondHistory = await send('/api/student/orders', { cookie: secondCookie });
  assert.equal(secondHistory.data.firstOrderDiscountEligible, true);
  assert.deepEqual(secondHistory.data.orders, []);

  const legacyCookie = await registerAndLogin(accounts[3]);
  const legacyUser = await pool.query('SELECT id FROM users WHERE email = $1', [accounts[3].email]);
  const legacyOrderId = randomUUID();
  const legacyOrderNumber = `CE-LEGACY-${randomUUID().slice(0, 8)}`;
  const legacySlotId = slotResponse.data.slots[2].id;
  await pool.query(
    `INSERT INTO orders
      (id, order_number, student_id, vendor_id, collection_slot_id,
       subtotal_cents, discount_cents, service_fee_cents, total_cents,
       status, idempotency_key, request_hash)
     VALUES ($1, $2, $3, 'fresh-bites', $4, 4500, 900, 500, 4100, 'Pending', $5, $6)`,
    [legacyOrderId, legacyOrderNumber, legacyUser.rows[0].id, legacySlotId, randomUUID(), 'legacy-order-hash'],
  );
  await pool.query('UPDATE collection_slots SET reserved = reserved + 1 WHERE id = $1', [legacySlotId]);
  const legacyHistory = await send('/api/student/orders', { cookie: legacyCookie });
  assert.equal(legacyHistory.data.firstOrderDiscountEligible, false);
  assert.equal(legacyHistory.data.orders[0].paymentStatus, 'unverified');

  const roleCheck = await send('/api/vendor/orders', { cookie: firstCookie });
  assert.equal(roleCheck.response.status, 403);

  const concurrentCookie = await registerAndLogin(accounts[2]);
  const concurrentSlots = await send('/api/collection-slots?vendorId=fresh-bites');
  const concurrentOrders = await Promise.all(concurrentSlots.data.slots.slice(4, 6).map((slot) =>
    send('/api/student/payments/checkout', {
      method: 'POST',
      cookie: concurrentCookie,
      payload: {
        items: [{ menuItemId: 'chicken-wrap', quantity: 1 }],
        collectionSlotId: slot.id,
        idempotencyKey: randomUUID(),
      },
    }),
  ));
  assert.deepEqual(concurrentOrders.map(({ response }) => response.status).sort(), [201, 409]);
  const concurrentFirst = concurrentOrders.find(({ response }) => response.status === 201);
  const concurrentSession = [...stripeSessions.values()].find((session) => session.metadata.paymentId === concurrentFirst.data.paymentId);
  assert.equal(concurrentSession.amount_total, 4100);
  assert.equal((await completePayment(concurrentFirst.data.paymentId)).response.status, 200);
  const concurrentSecond = await placePaidOrder(concurrentCookie, {
    items: [{ menuItemId: 'chicken-wrap', quantity: 1 }],
    collectionSlotId: concurrentSlots.data.slots[5].id,
    idempotencyKey: randomUUID(),
  });
  assert.equal(concurrentSecond.response.status, 201);
  const secondConcurrentSession = [...stripeSessions.values()].find((session) => session.metadata.paymentId === concurrentSecond.data.paymentId);
  assert.equal(secondConcurrentSession.amount_total, 5000);

  const vendorCookie = await registerVendorAndLogin();
  assert.ok(vendorCookie);
  const vendorResult = await pool.query(
    `SELECT id FROM vendors WHERE owner_user_id = (
       SELECT id FROM users WHERE email = $1
     )`,
    [vendorAccount.email],
  );
  const vendorId = vendorResult.rows[0].id;
  const studentMenuDenied = await send('/api/vendor/menu', { cookie: firstCookie });
  assert.equal(studentMenuDenied.response.status, 403);
  const vendorMenuInitiallyEmpty = await send('/api/vendor/menu', { cookie: vendorCookie });
  assert.deepEqual(vendorMenuInitiallyEmpty.data.items, []);

  const invalidMenuItem = await send('/api/vendor/menu', {
    method: 'POST',
    cookie: vendorCookie,
    payload: { name: 'Invalid Item', category: 'Test', description: '', priceCents: 0, available: true },
  });
  assert.equal(invalidMenuItem.response.status, 400);

  const firstPng = createPngPixel(220, 40, 80);
  const addedMenuItem = await sendMultipart('/api/vendor/menu', {
    cookie: vendorCookie,
    fields: {
      name: 'Test Menu Item',
      category: 'Test',
      description: 'Before edit',
      priceCents: 2500,
      available: true,
    },
    file: { name: 'menu-test.png', mimeType: 'image/png', buffer: firstPng },
  });
  assert.equal(addedMenuItem.response.status, 201);
  assert.equal(addedMenuItem.data.item.priceCents, 2500);
  assert.equal(addedMenuItem.data.item.vendorId, vendorId);
  assert.ok(addedMenuItem.data.item.imageUrl);
  const testMenuItemId = addedMenuItem.data.item.id;

  const privateImagePath = addedMenuItem.data.item.imageUrl;
  const unauthorizedImage = await fetch(`${baseUrl}${privateImagePath}`);
  assert.equal(unauthorizedImage.status, 401);
  const ownerImage = await fetch(`${baseUrl}${privateImagePath}`, { headers: { Cookie: vendorCookie } });
  assert.equal(ownerImage.status, 200);
  assert.equal(ownerImage.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await ownerImage.arrayBuffer()), firstPng);

  const spoofedImage = await sendMultipart('/api/vendor/menu', {
    cookie: vendorCookie,
    fields: { name: 'Spoofed Image', category: 'Test', description: '', priceCents: 100, available: true },
    file: { name: 'spoofed.jpg', mimeType: 'image/jpeg', buffer: firstPng },
  });
  assert.equal(spoofedImage.response.status, 400);

  const oversizedImage = await sendMultipart('/api/vendor/menu', {
    cookie: vendorCookie,
    fields: { name: 'Oversized Image', category: 'Test', description: '', priceCents: 100, available: true },
    file: { name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) },
  });
  assert.equal(oversizedImage.response.status, 413);

  const otherVendorCookie = await registerVendorAndLogin(otherVendorAccount);
  assert.ok(otherVendorCookie);
  const otherVendorMenu = await send('/api/vendor/menu', { cookie: otherVendorCookie });
  assert.deepEqual(otherVendorMenu.data.items, []);
  const otherVendorImage = await fetch(`${baseUrl}${privateImagePath}`, { headers: { Cookie: otherVendorCookie } });
  assert.equal(otherVendorImage.status, 404);
  const crossVendorEdit = await send(`/api/vendor/menu/${encodeURIComponent(testMenuItemId)}`, {
    method: 'PATCH',
    cookie: otherVendorCookie,
    payload: {
      name: 'Hijacked Item',
      category: 'Test',
      description: '',
      priceCents: 1,
      available: true,
    },
  });
  assert.equal(crossVendorEdit.response.status, 404);

  const updateUnavailable = await send(`/api/vendor/menu/${encodeURIComponent(testMenuItemId)}`, {
    method: 'PATCH',
    cookie: vendorCookie,
    payload: {
      name: 'Updated Test Menu Item',
      category: 'Meals',
      description: 'Updated before sale',
      priceCents: 3100,
      available: false,
    },
  });
  assert.equal(updateUnavailable.response.status, 200);
  assert.equal(updateUnavailable.data.item.priceCents, 3100);
  assert.equal(updateUnavailable.data.item.imageUrl, privateImagePath);
  const hiddenUnavailableItem = await send(`/api/menu?vendorId=${encodeURIComponent(vendorId)}`);
  assert.ok(!hiddenUnavailableItem.data.items.some((item) => item.id === testMenuItemId));
  const hiddenPublicImage = await fetch(`${baseUrl}/api/menu-items/${encodeURIComponent(testMenuItemId)}/image`);
  assert.equal(hiddenPublicImage.status, 404);
  const unavailableOwnerImage = await fetch(`${baseUrl}${privateImagePath}`, { headers: { Cookie: vendorCookie } });
  assert.equal(unavailableOwnerImage.status, 200);

  const vendorSlots = await send(`/api/collection-slots?vendorId=${encodeURIComponent(vendorId)}`);
  assert.ok(vendorSlots.data.slots.length > 0);
  const unavailableCheckout = await send('/api/student/payments/checkout', {
    method: 'POST',
    cookie: secondCookie,
    payload: {
      items: [{ menuItemId: testMenuItemId, quantity: 1 }],
      collectionSlotId: vendorSlots.data.slots[0].id,
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(unavailableCheckout.response.status, 409);
  const eligibilityAfterUnavailableItem = await send('/api/student/orders', { cookie: secondCookie });
  assert.equal(eligibilityAfterUnavailableItem.data.firstOrderDiscountEligible, true);

  const replacementPng = createPngPixel(20, 170, 90);
  const updateAvailable = await sendMultipart(`/api/vendor/menu/${encodeURIComponent(testMenuItemId)}`, {
    method: 'PATCH',
    cookie: vendorCookie,
    fields: {
      name: 'Updated Test Menu Item',
      category: 'Meals',
      description: 'Updated and available',
      priceCents: 3100,
      available: true,
    },
    file: { name: 'replacement.png', mimeType: 'image/png', buffer: replacementPng },
  });
  assert.equal(updateAvailable.response.status, 200);
  assert.notEqual(updateAvailable.data.item.imageUrl, null);
  const visibleUpdatedItem = await send(`/api/menu?vendorId=${encodeURIComponent(vendorId)}`);
  assert.equal(visibleUpdatedItem.data.items.find((item) => item.id === testMenuItemId).priceCents, 3100);
  const publicImagePath = visibleUpdatedItem.data.items.find((item) => item.id === testMenuItemId).imageUrl;
  const publicImage = await fetch(`${baseUrl}${publicImagePath}`);
  assert.equal(publicImage.status, 200);
  assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), replacementPng);

  const vendorCheckoutPayload = {
    items: [{ menuItemId: testMenuItemId, quantity: 1 }],
    collectionSlotId: vendorSlots.data.slots[0].id,
    idempotencyKey: randomUUID(),
  };
  const vendorCheckout = await send('/api/student/payments/checkout', {
    method: 'POST',
    cookie: secondCookie,
    payload: vendorCheckoutPayload,
  });
  assert.equal(vendorCheckout.response.status, 201);
  const resumedCheckout = await send('/api/student/payments/checkout', {
    method: 'POST',
    cookie: secondCookie,
    payload: { ...vendorCheckoutPayload, idempotencyKey: randomUUID() },
  });
  assert.equal(resumedCheckout.response.status, 200);
  assert.equal(resumedCheckout.data.paymentId, vendorCheckout.data.paymentId);
  assert.equal(resumedCheckout.data.checkoutUrl, vendorCheckout.data.checkoutUrl);
  const pendingPayment = await send(`/api/student/payments/${vendorCheckout.data.paymentId}`, { cookie: secondCookie });
  assert.equal(pendingPayment.data.paymentStatus, 'pending');
  const otherStudentPayment = await send(`/api/student/payments/${vendorCheckout.data.paymentId}`, { cookie: firstCookie });
  assert.equal(otherStudentPayment.response.status, 404);
  assert.equal(pendingPayment.data.order.subtotalCents, 3100);
  assert.equal(pendingPayment.data.order.discountCents, 620);

  const hiddenUnpaidOrder = await send('/api/vendor/orders', { cookie: vendorCookie });
  assert.deepEqual(hiddenUnpaidOrder.data.orders, []);
  const unpaidTransition = await send(
    `/api/vendor/orders/${encodeURIComponent(pendingPayment.data.order.id)}/status`,
    { method: 'PATCH', cookie: vendorCookie, payload: { status: 'Confirmed' } },
  );
  assert.equal(unpaidTransition.response.status, 404);

  const vendorSession = [...stripeSessions.values()].find((session) => session.metadata.paymentId === vendorCheckout.data.paymentId);
  assert.equal((await sendStripeEvent('checkout.session.completed', vendorSession, { invalidSignature: true })).response.status, 400);
  const mismatchedSession = { ...vendorSession, amount_total: vendorSession.amount_total + 100 };
  assert.equal((await sendStripeEvent('checkout.session.completed', mismatchedSession)).response.status, 400);
  const wrongCurrencySession = { ...vendorSession, currency: 'usd' };
  assert.equal((await sendStripeEvent('checkout.session.completed', wrongCurrencySession)).response.status, 400);
  vendorSession.status = 'complete';
  vendorSession.payment_status = 'unpaid';
  assert.equal((await sendStripeEvent('checkout.session.completed', vendorSession)).response.status, 200);
  const stillPending = await send(`/api/student/payments/${vendorCheckout.data.paymentId}`, { cookie: secondCookie });
  assert.equal(stillPending.data.paymentStatus, 'pending');
  const completionEventId = `evt_${randomUUID().replaceAll('-', '')}`;
  vendorSession.payment_status = 'paid';
  vendorSession.payment_intent = `pi_test_${vendorSession.id}`;
  assert.equal((await sendStripeEvent('checkout.session.async_payment_succeeded', vendorSession, { eventId: completionEventId })).response.status, 200);
  assert.equal((await sendStripeEvent('checkout.session.async_payment_succeeded', vendorSession, { eventId: completionEventId })).response.status, 200);
  const paidPayment = await send(`/api/student/payments/${vendorCheckout.data.paymentId}`, { cookie: secondCookie });
  assert.equal(paidPayment.data.paymentStatus, 'paid');
  const vendorOrder = { response: vendorCheckout.response, data: { ...vendorCheckout.data, order: paidPayment.data.order } };

  const vendorHistory = await send('/api/vendor/orders', { cookie: vendorCookie });
  assert.equal(vendorHistory.data.orders.length, 1);
  assert.equal(vendorHistory.data.orders[0].orderId, vendorOrder.data.order.orderId);

  const unpaidCancellation = await send(`/api/vendor/orders/${encodeURIComponent(vendorOrder.data.order.id)}/status`, {
    method: 'PATCH', cookie: vendorCookie, payload: { status: 'Cancelled' },
  });
  assert.equal(unpaidCancellation.response.status, 400);

  const statusUpdate = await send(`/api/vendor/orders/${encodeURIComponent(vendorOrder.data.order.id)}/status`, {
    method: 'PATCH',
    cookie: vendorCookie,
    payload: { status: 'Confirmed' },
  });
  assert.equal(statusUpdate.response.status, 200);
  assert.equal(statusUpdate.data.order.status, 'Confirmed');

  const trackedOrder = await send('/api/student/orders', { cookie: secondCookie });
  assert.equal(
    trackedOrder.data.orders.find((order) => order.orderId === vendorOrder.data.order.orderId).status,
    'Confirmed',
  );
  assert.equal(
    trackedOrder.data.orders.find((order) => order.orderId === vendorOrder.data.order.orderId).paymentStatus,
    'paid',
  );

  const expiringSlot = vendorSlots.data.slots[1];
  const remainingBeforeExpiry = (await send(`/api/collection-slots?vendorId=${encodeURIComponent(vendorId)}`))
    .data.slots.find((slot) => slot.id === expiringSlot.id).remaining;
  const expiringCheckout = await send('/api/student/payments/checkout', {
    method: 'POST',
    cookie: secondCookie,
    payload: {
      items: [{ menuItemId: testMenuItemId, quantity: 1 }],
      collectionSlotId: expiringSlot.id,
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(expiringCheckout.response.status, 201);
  const expiringSession = [...stripeSessions.values()].find((session) => session.metadata.paymentId === expiringCheckout.data.paymentId);
  expiringSession.status = 'expired';
  const expiryEventId = `evt_${randomUUID().replaceAll('-', '')}`;
  assert.equal((await sendStripeEvent('checkout.session.expired', expiringSession, { eventId: expiryEventId })).response.status, 200);
  assert.equal((await sendStripeEvent('checkout.session.expired', expiringSession, { eventId: expiryEventId })).response.status, 200);
  const expiredPayment = await send(`/api/student/payments/${expiringCheckout.data.paymentId}`, { cookie: secondCookie });
  assert.equal(expiredPayment.data.paymentStatus, 'expired');
  assert.equal(expiredPayment.data.order.status, 'Cancelled');
  const remainingAfterExpiry = (await send(`/api/collection-slots?vendorId=${encodeURIComponent(vendorId)}`))
    .data.slots.find((slot) => slot.id === expiringSlot.id).remaining;
  assert.equal(remainingAfterExpiry, remainingBeforeExpiry);

  const failingSlot = vendorSlots.data.slots[2];
  const failingCheckout = await send('/api/student/payments/checkout', {
    method: 'POST',
    cookie: secondCookie,
    payload: {
      items: [{ menuItemId: testMenuItemId, quantity: 1 }],
      collectionSlotId: failingSlot.id,
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(failingCheckout.response.status, 201);
  const failingSession = [...stripeSessions.values()].find((session) => session.metadata.paymentId === failingCheckout.data.paymentId);
  failingSession.status = 'complete';
  const failingSlotRemaining = (await send(`/api/collection-slots?vendorId=${encodeURIComponent(vendorId)}`))
    .data.slots.find((slot) => slot.id === failingSlot.id).remaining;
  failingSession.payment_status = 'unpaid';
  assert.equal((await sendStripeEvent('checkout.session.async_payment_failed', failingSession)).response.status, 200);
  const failedPayment = await send(`/api/student/payments/${failingCheckout.data.paymentId}`, { cookie: secondCookie });
  assert.equal(failedPayment.data.paymentStatus, 'failed');
  assert.equal(failedPayment.data.order.status, 'Cancelled');
  const failedSlotRemaining = (await send(`/api/collection-slots?vendorId=${encodeURIComponent(vendorId)}`))
    .data.slots.find((slot) => slot.id === failingSlot.id).remaining;
  assert.equal(failedSlotRemaining, failingSlotRemaining + 1);

  const removeMenuImage = await sendMultipart(`/api/vendor/menu/${encodeURIComponent(testMenuItemId)}`, {
    method: 'PATCH',
    cookie: vendorCookie,
    fields: {
      name: 'Updated Test Menu Item',
      category: 'Meals',
      description: 'Updated and available',
      priceCents: 3100,
      available: true,
      removeImage: true,
    },
  });
  assert.equal(removeMenuImage.response.status, 200);
  assert.equal(removeMenuImage.data.item.imageUrl, null);
  const removedOwnerImage = await fetch(`${baseUrl}${privateImagePath}`, { headers: { Cookie: vendorCookie } });
  assert.equal(removedOwnerImage.status, 404);

  const removeOrderedMenuItem = await send(`/api/vendor/menu/${encodeURIComponent(testMenuItemId)}`, {
    method: 'DELETE',
    cookie: vendorCookie,
  });
  assert.equal(removeOrderedMenuItem.response.status, 200);
  assert.equal(removeOrderedMenuItem.data.retired, true);
  const retiredMenu = await send('/api/vendor/menu', { cookie: vendorCookie });
  assert.equal(retiredMenu.data.items.find((item) => item.id === testMenuItemId).available, false);
  const retiredFromStudentMenu = await send(`/api/menu?vendorId=${encodeURIComponent(vendorId)}`);
  assert.ok(!retiredFromStudentMenu.data.items.some((item) => item.id === testMenuItemId));
});