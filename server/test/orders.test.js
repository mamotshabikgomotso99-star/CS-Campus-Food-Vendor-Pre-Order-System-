const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { deflateSync } = require('node:zlib');

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
  const server = createApp(pool).listen(0, '127.0.0.1');
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
  ];
  const vendorAccount = {
    email: `order-test-vendor-${uniqueId}@example.invalid`,
    vendorName: `Order Test Vendor ${uniqueId}`,
  };
  const otherVendorAccount = {
    email: `order-test-other-vendor-${uniqueId}@example.invalid`,
    vendorName: `Other Order Test Vendor ${uniqueId}`,
  };

  context.after(async () => {
    try {
      const emailList = [...accounts.map((account) => account.email), vendorAccount.email, otherVendorAccount.email];
      await pool.query('BEGIN');
      await pool.query(
        `UPDATE collection_slots slot
            SET reserved = GREATEST(0, slot.reserved - order_counts.count)
           FROM (
             SELECT collection_slot_id, COUNT(*)::INTEGER AS count
               FROM orders
              WHERE student_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))
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
        'DELETE FROM menu_items WHERE vendor_id IN (SELECT id FROM vendors WHERE owner_user_id IN (SELECT id FROM users WHERE email = ANY($1::text[])))',
        [emailList],
      );
      await pool.query(
        'DELETE FROM collection_slots WHERE vendor_id IN (SELECT id FROM vendors WHERE owner_user_id IN (SELECT id FROM users WHERE email = ANY($1::text[])))',
        [emailList],
      );
      await pool.query(
        'DELETE FROM vendors WHERE owner_user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))',
        [emailList],
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
    const registration = await send('/api/auth/register', {
      method: 'POST',
      payload: {
        fullName: 'Order Test Vendor',
        email: account.email,
        password: 'test-password-123',
        confirmPassword: 'test-password-123',
        role: 'vendor',
        vendorName: account.vendorName,
      },
    });
    assert.equal(registration.response.status, 201);

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

  const firstHistory = await send('/api/student/orders', { cookie: firstCookie });
  assert.equal(firstHistory.data.firstOrderDiscountEligible, true);
  assert.deepEqual(firstHistory.data.orders, []);

  const slotResponse = await send('/api/collection-slots?vendorId=fresh-bites');
  assert.ok(slotResponse.data.slots.length >= 2);
  const invalidOrder = await send('/api/student/orders', {
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
  const firstOrder = await send('/api/student/orders', {
    method: 'POST',
    cookie: firstCookie,
    payload: firstPayload,
  });
  assert.equal(firstOrder.response.status, 201);
  assert.equal(firstOrder.data.order.subtotalCents, 4500);
  assert.equal(firstOrder.data.order.discountCents, 900);
  assert.equal(firstOrder.data.order.serviceFeeCents, 500);
  assert.equal(firstOrder.data.order.totalCents, 4100);

  const firstRetry = await send('/api/student/orders', {
    method: 'POST',
    cookie: firstCookie,
    payload: firstPayload,
  });
  assert.equal(firstRetry.response.status, 200);
  assert.equal(firstRetry.data.order.orderId, firstOrder.data.order.orderId);

  const secondOrder = await send('/api/student/orders', {
    method: 'POST',
    cookie: firstCookie,
    payload: {
      items: [{ menuItemId: 'chicken-wrap', quantity: 1 }],
      collectionSlotId: slotResponse.data.slots[1].id,
      idempotencyKey: randomUUID(),
    },
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

  const roleCheck = await send('/api/vendor/orders', { cookie: firstCookie });
  assert.equal(roleCheck.response.status, 403);

  const concurrentCookie = await registerAndLogin(accounts[2]);
  const concurrentSlots = await send('/api/collection-slots?vendorId=fresh-bites');
  const concurrentOrders = await Promise.all(concurrentSlots.data.slots.slice(4, 6).map((slot) =>
    send('/api/student/orders', {
      method: 'POST',
      cookie: concurrentCookie,
      payload: {
        items: [{ menuItemId: 'chicken-wrap', quantity: 1 }],
        collectionSlotId: slot.id,
        idempotencyKey: randomUUID(),
      },
    }),
  ));
  assert.ok(concurrentOrders.every(({ response }) => response.status === 201));
  assert.deepEqual(
    concurrentOrders.map(({ data }) => data.order.discountCents).sort((left, right) => left - right),
    [0, 900],
  );

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
  const unavailableCheckout = await send('/api/student/orders', {
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

  const vendorOrder = await send('/api/student/orders', {
    method: 'POST',
    cookie: secondCookie,
    payload: {
      items: [{ menuItemId: testMenuItemId, quantity: 1 }],
      collectionSlotId: vendorSlots.data.slots[0].id,
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(vendorOrder.response.status, 201);
  assert.equal(vendorOrder.data.order.subtotalCents, 3100);
  assert.equal(vendorOrder.data.order.discountCents, 620);

  const vendorHistory = await send('/api/vendor/orders', { cookie: vendorCookie });
  assert.equal(vendorHistory.data.orders.length, 1);
  assert.equal(vendorHistory.data.orders[0].orderId, vendorOrder.data.order.orderId);

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