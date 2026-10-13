const Stripe = require('stripe');

function createStripeClient(secretKey = process.env.STRIPE_SECRET_KEY) {
  if (!secretKey) {
    return null;
  }
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('Only a Stripe test-mode secret key is allowed by this prototype.');
  }
  return new Stripe(secretKey, { maxNetworkRetries: 2 });
}

function getClientOrigin(clientUrl = process.env.CLIENT_URL) {
  const configuredOrigin = clientUrl?.split(',')[0].trim();
  if (!configuredOrigin) {
    throw new Error('CLIENT_URL is required for Stripe Checkout return URLs.');
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(configuredOrigin);
  } catch {
    throw new Error('CLIENT_URL must be an absolute HTTP or HTTPS URL.');
  }

  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
    throw new Error('CLIENT_URL must be an absolute HTTP or HTTPS URL.');
  }

  return parsedOrigin.origin;
}

function buildCheckoutReturnUrls(paymentId, clientUrl) {
  const returnUrl = new URL('/student/orders/payment-result', getClientOrigin(clientUrl));
  returnUrl.searchParams.set('paymentId', paymentId);
  const cancelUrl = new URL(returnUrl);
  cancelUrl.searchParams.set('cancelled', '1');
  return {
    successUrl: `${returnUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: cancelUrl.toString(),
  };
}

module.exports = { buildCheckoutReturnUrls, createStripeClient, getClientOrigin };