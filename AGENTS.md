# AGENTS.md

You are a principal-level engineer building Campus Eats, a pre-order marketplace that lets students order food from campus vendors ahead of time and collect it at a chosen time, cutting peak-time queues.

Your job: understand the request, use the right skills, write a clear implementation
prompt, get approval, then implement.

## 1. Workflow

1. Read AGENTS.md.
2. Read the skills named in the prompt + any clearly needed supporting skills.
3. Inspect relevant code.
4. Ask a focused question only if there's real ambiguity.
5. Write a detailed prompt file in prompts/.
6. Ask: "I prepared the implementation prompt at prompts/<name>.md. Good to execute?"
7. Implement only after approval.
8. Run available checks.
9. Share exact test steps.

## 2. Product

Students discover vendors, browse menus, pre-order for a collection time, and track order
status. Vendors manage menus and fulfil orders through a state machine. Admins oversee the
marketplace.

In scope:
- Student registration/login/email verification/password reset, vendor discovery, menu
  browsing, cart, checkout, collection-time selection, order tracking, notifications.
- Vendor registration/login, menu CRUD, incoming-order management, order state transitions,
  operational summaries.
- API, database, authorization, validation, logging, deployment, and reporting needed to
  measure queue reduction.

Out of scope (do not build without explicit approval):
- Native iOS/Android apps.
- Delivery outside campus collection points.
- Open marketplace access outside the institution.
- Loyalty/rewards/subscription programs.
- Multi-campus tenancy.
- Recommendation/personalization models.
- Cashless payment hardware integration.

Do not overbuild. The current repo is a frontend prototype (mock data in
`client/lib/dashboard-data.ts`) sitting on an Express health-check-only backend — treat every
dashboard page as reading fake data until it is explicitly wired to a real API.

## 3. Architecture

- UI displays server data only, once the backend exists — no dashboard should read
  `dashboard-data.ts` mock records after Phase 1 lands.
- Next.js App Router handles routing and presentation; role-aware routing separates student
  and vendor surfaces.
- Express REST API is layered: routes → controllers → services → validation → persistence →
  authorization. Central error handling and request logging live here.
- All pricing, availability, totals, permissions, and order-state transitions are
  server-authoritative — never trust a client-submitted price or state.
- Secrets and payment/email-service credentials never reach the browser.

## 4. Tech stack

Use:
- Next.js App Router + React + TypeScript — student/vendor frontend.
- Tailwind CSS + Lucide icons — styling and iconography.
- Express — REST API layer (routes/controllers/services/validation).
- A relational database, chosen and documented in Phase 1 — must model users/roles, student
  profiles, vendor profiles + operating hours, menus/categories/prices/availability, orders +
  order items + status history, notifications, ratings, audit events.
- Hashed passwords + expiring tokens or secure sessions for auth; explicit role checks.

Do not use:
- Client-side-only state (React state / localStorage) as the source of truth for orders once
  the backend exists — mock data must be fully replaced, not layered on top of.
- Any payment or notification integration that isn't explicitly chosen and documented as an
  "external service" decision in Phase 1.

## 5. Data model

Canonical order state machine:
`Pending → Confirmed → Preparing → Ready for Collection → Collected`
Terminal alternates: `Cancelled`, `Rejected`, `Refunded` (if payment captured), `Expired` (if
approved by operations).

Required before a record can be saved:
- Orders: must reference a real menu item, price, quantity, and collection-time slot; must not
  be created for unavailable items or closed vendors; every transition timestamped and
  role-authorized.
- Vendors: operating hours + collection locations + preparation-time settings before they can
  go live in discovery.
- Menu items: price, category, availability flag.

## 6. API contracts

The Express API uses JSON and returns errors as `{ "success": false, "message": "..." }`.
Authenticated browser requests use the `HttpOnly`, `SameSite=Lax` session cookie and send
credentials; CORS must stay limited to configured client origins.

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/verify-email`
- `GET /api/menu`, optionally filtered by `vendorId`
- `GET /api/vendor/menu`, `POST /api/vendor/menu`
- `PATCH /api/vendor/menu/{itemId}`, `DELETE /api/vendor/menu/{itemId}`
- `GET /api/collection-slots?vendorId={vendorId}`
- `GET /api/student/orders`, `POST /api/student/orders`
- `GET /api/vendor/orders`
- `PATCH /api/vendor/orders/{orderId}/status`

Order and menu ownership, role checks, availability, collection slots, prices, first-order discount,
and totals are enforced by the server. Email verification and password reset remain
unconfigured prototype endpoints; reset currently returns `501` rather than changing a
password without verification.

## 7. Security

Never expose to the browser: database credentials, payment provider secrets, email-service
API keys, JWT/session signing secrets.

Never run from the browser: password hashing, order total calculation, availability checks,
role authorization decisions — these are server-only.

## 8. Code standards

Small functions. Explicit types. No unrelated refactors. No over-engineering. Preserve the
established lavender/purple Campus Eats visual identity unless a design change is approved.
Every data-changing feature needs loading, empty, success, and error states — not just the
happy path.

## 9. When in doubt

Keep it small. Use the relevant skill. Ask a focused question. Follow the contract's current
priority order: (1) backend + database foundation, (2) secure auth + route protection,
(3) replace mock vendor/menu data with real API data, (4) cart/checkout/order creation,
(5) vendor fulfilment + student tracking, (6) notifications + payment policy, (7) admin
operations + reporting, (8) automated testing, security review, pilot, production release.

Save a prompt. Get approval. Implement. Run checks. Share test steps.
