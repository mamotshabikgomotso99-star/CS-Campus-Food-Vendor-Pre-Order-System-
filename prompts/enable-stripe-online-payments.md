# Enable Stripe online payments

## Decision
Use Stripe-hosted Checkout in test mode for one-time ZAR card payments. Stripe is the selected external payment service for this prototype. Do not collect or store card numbers, CVV, or expiry in Campus Eats. Live-mode credentials and production activation require a separate operational approval.

## Goal
Require successful online payment before an order reaches a vendor. Students choose items and a collection slot, review the server-calculated amount, and are redirected to Stripe Checkout. Return-page parameters are never proof of payment; only a verified Stripe webhook can mark payment successful.

## Current architecture
- Next.js client calls the Express API in `server/app.js`.
- PostgreSQL schema changes use versioned SQL migrations registered in `server/database.js`.
- `POST /api/student/orders` currently creates a Pending order immediately; vendor order listing currently returns all vendor orders.
- Client checkout is in `client/components/orders/StudentCheckout.tsx`.
- The service fee and first-order discount are calculated and enforced by the API.

## Implementation requirements

### 1) Document the provider decision
- Update `PROJECT_CONTRACT.md` and its change log to record Stripe-hosted Checkout in test mode as the selected payment service.
- Document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the public API webhook URL, `CLIENT_URL`, local Stripe CLI forwarding, and that production is disabled until live credentials and operational approval are provided.
- Update `server/.env.example` with empty, safe placeholders only. Never read or copy values from local `.env` files.

### 2) Persist payment state
- Add a versioned migration and register it in `server/database.js`.
- Persist one payment record per order with provider, Stripe Checkout Session ID, amount in cents, currency, payment status, and timestamps. Track processed Stripe event IDs with a uniqueness constraint for webhook idempotency.
- Keep payment state separate from the fulfilment state. Preserve historical orders without falsely marking them paid.
- Unpaid, failed, expired, or otherwise unverified orders must not be visible in the vendor queue and must not be fulfilable.
- Reserve collection capacity when starting payment, and release it exactly once when a Checkout Session expires. A successful payment retains the reservation.
- Keep order ownership, item availability, collection slot, discount eligibility, fee, and final total server-authoritative.
- Preserve order idempotency; retries for an existing unpaid order must reuse that order/payment and must not consume another first-order discount or reserve a second slot.

### 3) Create a Stripe Checkout Session on the server
- Add an authenticated student endpoint that validates selected items and collection slot, computes all prices/discounts/fees from the database, persists the pending order/payment, and creates a Stripe Checkout Session using the official `stripe` Node SDK.
- Use `mode: "payment"`, card payments only, currency `zar`, and a server-created line item with the exact authoritative order total in minor units. Include the internal payment/order IDs in Stripe metadata.
- Return only the hosted session URL and non-secret payment/order identifiers to the browser. Never expose the Stripe secret key or webhook signing secret.
- Use a stable Stripe idempotency key derived from the persisted payment attempt. Do not accept amount, currency, order status, or payment status from the client.
- If Stripe configuration is missing, fail closed with a clear configuration error; never fall back to pay-at-collection or create a paid order.
- Handle Stripe API failures without leaving an order permanently fulfilable or leaking a slot reservation.

### 4) Verify Stripe webhooks
- Add a public `POST` webhook route before `express.json()` middleware so the official SDK receives the exact raw request body.
- Verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` using the Stripe SDK. Reject invalid signatures and malformed payloads.
- Handle only the required Checkout events, including `checkout.session.completed` and `checkout.session.expired`. Mark paid only when the verified Checkout Session matches the stored session/payment/order, is complete, has `payment_status === "paid"`, and its amount and currency match the server record.
- Process each event transactionally and idempotently. A duplicate event must return success without repeating state changes; never trust the success redirect or query string.
- On expiry, mark payment expired, cancel its unpaid order, and release its slot reservation once. Failed card attempts that leave the Checkout Session open must remain retryable rather than being prematurely fulfilled or released.
- Do not log full webhook payloads or secret values.

### 5) Connect student checkout and payment status
- Replace direct order creation with the authenticated payment-initiation endpoint and redirect to Stripe’s returned Checkout URL.
- Keep item, vendor, collection-slot, total, loading, and error states; remove all pay-at-collection copy and paths.
- Add a student-owned payment-status endpoint and return page. Poll/refresh server state after redirect; show success only after the webhook has verified payment. Show cancelled, expired, pending, and retry states clearly.
- A cancelled browser return does not mark payment failed by itself. Allow safe retry without creating a duplicate order or reservation.
- Show payment status separately from fulfilment status in student order history where appropriate.

### 6) Protect vendor fulfilment
- Vendor order listing must include only orders whose payment is verified as paid, while preserving historical records without misclassifying them as paid.
- Vendor status transitions must independently require a paid payment record.
- Preserve the existing order state machine for paid orders.

### 7) Security and operations
- Use only Stripe test keys during this implementation. Keep all secret keys on the server.
- Do not add client-side Stripe card collection; use Stripe-hosted Checkout.
- Configure the Stripe CLI forwarding command for local webhook testing and document the required endpoint/events.
- Keep current CORS and session-cookie settings unless a narrowly necessary, documented change is identified.
- Do not claim production readiness: a real Stripe account, webhook endpoint, live credentials, refund/cancellation policy, and operational approval remain required.

## Acceptance criteria
- Student checkout redirects to Stripe test-mode Checkout; Campus Eats offers no pay-at-collection option.
- No card data or Stripe secrets enter Campus Eats browser state, API payloads, database, or logs.
- Browser success/cancel redirects alone cannot change payment or fulfilment state.
- A valid signed and matching webhook marks payment paid exactly once and exposes the order to the vendor as Pending.
- Invalid signatures, mismatched sessions/amount/currency, expired sessions, duplicate events, and unauthenticated status requests are handled safely.
- Unpaid or expired orders are not returned to vendors and cannot transition state.
- Retries do not duplicate an order, first-order discount, or collection-slot reservation.
- Existing order tests, TypeScript checks, lint, migration checks, and targeted payment/webhook tests pass.

## Test plan
- Use the Stripe SDK to create signed test webhook fixtures; do not require live credentials for unit/integration tests.
- Cover completed-paid, completed-unpaid, expired, invalid signature, wrong session, amount/currency mismatch, duplicate event, and retry/idempotency cases.
- Verify unpaid orders are absent from vendor orders and cannot transition; a valid paid event makes the order visible and fulfilable.
- Test checkout session creation with a mocked Stripe client and confirm the amount and ZAR currency come only from server calculations.
- Complete an actual Stripe test-mode redirect and webhook flow only after test keys and Stripe CLI forwarding are configured.