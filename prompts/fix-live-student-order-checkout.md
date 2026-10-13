# Fix the live student ordering and checkout flow

## Goal
Use the existing backend contract and make the student experience fully interactive end-to-end: log in, browse live vendors, open a vendor menu, choose collection slots, place an order, and track the order after checkout.

## Current problem
The prototype has a working Express API and live data hooks, but some student-facing routes still point to static dashboard content or route placeholders instead of the real vendor/order flow. The app should behave as a live campus marketplace rather than a mock demo.

## Scope

### 1) Role-aware auth flow
- Keep the backend as the source of truth for auth and session state.
- Make sure session checks and redirects are role-aware for students and vendors.
- Ensure the app redirects logged-in users to the correct role dashboard instead of a generic placeholder route.
- Keep the student-only checkout flow behind `RequireAuth role="student"`.

### 2) Student dashboard and vendor discovery
- Replace any remaining placeholder links or static dashboard content with the live student routes:
  - `/student/dashboard`
  - `/student/vendors`
  - `/student/vendors/[vendorId]`
  - `/student/orders/new`
  - `/student/orders`
- Ensure the vendor cards and menu view pull server data in real time and show useful empty/loading/error states.

### 3) Live checkout and order creation
- Confirm the checkout page reads vendor listings and collection slots from the API.
- Make sure order creation calls the real `POST /api/student/orders` route with valid payloads:
  - `items[]` with `menuItemId` and `quantity`
  - `collectionSlotId`
  - `idempotencyKey`
- Do not collect card details or imply an online charge; payment processing is not integrated, so tell students to pay at collection.
- Keep pricing, availability, discount eligibility, and final totals server-authoritative.
- Handle success states, duplicate request protection, and rejection messages cleanly.

### 4) Student order tracking
- Ensure the student order list uses live data from `GET /api/student/orders`.
- Show order status, collection time, discount, and totals from the backend.
- Ensure a successful order can be followed through to the tracking screen.

### 5) Error handling and UX polish
- Preserve the lavender Campus Eats visual style.
- Add or improve loading, empty, error, and success states for all relevant steps.
- Keep actions small and explicit; do not overbuild beyond the current product contract.

## Acceptance criteria
- A student can sign in and see the student dashboard.
- A student can browse vendors and open a vendor menu.
- A student can select a collection slot and place a real order.
- The order is created from the backend and appears in the student order list.
- The app does not rely on mock dashboard data for live commerce actions.
- Route protection and role checks keep the student checkout experience student-only.

## Validation
Run the available checks after implementation and confirm the order flow works locally using the configured frontend and API tasks.
