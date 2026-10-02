# Make Student Orders Real and Account-Specific

## Objective
Make a newly registered student's order history genuinely empty, allow them to place an order, and show only their own persisted orders and current statuses in the student dashboard and `/student/orders`.

## Current Findings
- `client/lib/dashboard-data.ts` exports four global sample student orders, which the student dashboard and orders page render for every account.
- `/student/orders/new` is static UI: item quantities, collection time, totals, and its confirm button do not create an order.
- The Express API has no order endpoints or database. Accounts are held in an in-memory map, and the frontend's cached identity is display-only, not trusted authentication.
- Therefore, filtering sample data by client email or storing orders only in the browser would not provide secure, persistent, account-specific orders.

## Scope
- Follow the repository's Phase 1 priority and select/document a relational database and migrations for users, menu items, orders, order items, and timestamped order status history.
- Establish server-verified authentication/session identity and role authorization before associating orders with an account. Never authorize by a client-submitted email or trust client-submitted price, total, availability, or status.
- Add the minimum API/services/validation needed to fetch a student's orders, create an order from available menu items and quantities with a valid collection slot, and expose vendor-authorized status transitions through the existing vendor order workflow.
- Connect student checkout to real menu data and server-calculated totals; connect the student dashboard and orders page to that student's API results. Remove global sample student orders from these views.
- Show a clear empty state with a path to browse vendors when the signed-in student has no orders. Include loading, success, and useful error states for order creation and order retrieval.
- Keep order status authoritative on the server and refresh in-progress order status in the student UI so vendor changes appear promptly. Do not add payments, external notifications, delivery, or unrelated dashboard migrations.
- Keep existing mock vendor/dashboard data only where outside this student ordering vertical slice; do not imply those records are real.

## Acceptance Criteria
- A newly registered student with no orders sees an empty order state and no sample orders on the dashboard or order history.
- A student can select available menu items, choose a valid collection time, and create an order; the server validates menu availability and computes all pricing.
- The new order remains after page reload and appears only to its owner in the dashboard and order history.
- A second student cannot read or change the first student's order by altering browser state or request parameters.
- Vendor-authorized status updates are persisted and become visible in student order tracking without relying on static mock data.
- API failures, invalid checkout, empty orders, loading, and success are handled visibly.
- Database choice, migration/setup instructions, and API route/error conventions are documented; client lint/build and server checks pass, with focused API and browser workflow verification.
