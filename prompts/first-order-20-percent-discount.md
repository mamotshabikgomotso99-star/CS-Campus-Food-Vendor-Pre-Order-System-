# First-Order 20% Discount

## Objective
Give each student a 20% discount on their first successfully placed order, and no later orders.

## Current Findings
- The student checkout page currently displays fixed sample items and totals; its Confirm Order button does not submit an order.
- The Express API has no order endpoint or persistent database, and login does not establish a server-verified session.
- A client-only discount or client-submitted email/order count cannot safely establish eligibility or authoritative pricing.
- The project contract requires server-calculated totals and persistent order creation in Phase 3, following the database/auth foundation.

## Scope
- Implement the minimum required server-backed account identity and relational persistence for student accounts and orders, selecting and documenting the database and migrations consistent with the project contract.
- Implement a real student checkout/order-creation flow sufficient to submit available menu items and a collection slot. The server validates availability and quantities, fetches authoritative prices, computes totals, and persists the order.
- For a student's first successfully persisted order only, calculate a discount equal to 20% of the food-item subtotal. Exclude service fees from the discount. Round currency amounts to two decimal places and clearly show subtotal, discount, service fee, and final total before confirmation and in the persisted order.
- Determine eligibility only from persisted server-owned order history and authenticated student identity. Consume eligibility atomically when the first order is successfully created so concurrent/retried requests cannot use the offer more than once. Failed validation or failed persistence does not consume it; a later cancellation/refund does not restore it.
- Do not require a promo code. On later orders, show no discount and calculate the normal total.
- Connect student order history/dashboard and vendor incoming orders to the persisted order data; a new account continues to see the empty order state until an order is successfully created.
- Add validation, loading, success, and actionable error states. Do not add external payment or notification integrations.
- Keep vendor/menu mock content outside the minimum server-authoritative checkout catalog out of scope; do not claim mock items are real inventory. If checkout needs a minimal persisted catalog to calculate authoritative prices, seed/document only the existing prototype menu items needed for the flow.

## Acceptance Criteria
- A student with no prior orders sees the 20% first-order discount at checkout and the server stores the discounted total on successful submission.
- The discount equals 20% of the item subtotal, not the service fee; displayed and stored totals agree to two decimal places.
- The same student receives no discount on a second order, including after a first order is later cancelled or refunded.
- Invalid, failed, or abandoned checkouts do not consume the first-order discount.
- Two simultaneous submissions cannot both receive the discount; retries cannot create duplicate orders or reuse the benefit.
- Another student account has separate eligibility and cannot view or manipulate the first student's orders.
- Vendor order views receive successfully created orders and server-authorized status changes remain compatible with student tracking.
- Database choice, setup/migrations, and API/error conventions are documented; focused server tests, client lint/build, and browser checkout verification pass.
