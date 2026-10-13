const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCheckoutReturnUrls, createStripeClient, getClientOrigin } = require('../payments');

test('Stripe client only accepts test-mode secret keys', () => {
  assert.equal(createStripeClient(''), null);
  assert.throws(() => createStripeClient('sk_live_example'), /test-mode/);
  assert.equal(typeof createStripeClient('sk_test_example').checkout.sessions.create, 'function');
});

test('Checkout return URLs are derived from the configured client origin', () => {
  const urls = buildCheckoutReturnUrls('payment-id', 'https://campus.example/path,http://localhost:3000');
  assert.equal(
    urls.successUrl,
    'https://campus.example/student/orders/payment-result?paymentId=payment-id&session_id={CHECKOUT_SESSION_ID}',
  );
  assert.equal(
    urls.cancelUrl,
    'https://campus.example/student/orders/payment-result?paymentId=payment-id&cancelled=1',
  );
});

test('Stripe return URL configuration rejects missing and non-HTTP origins', () => {
  assert.throws(() => getClientOrigin(''), /CLIENT_URL is required/);
  assert.throws(() => getClientOrigin('javascript:alert(1)'), /HTTP or HTTPS/);
});