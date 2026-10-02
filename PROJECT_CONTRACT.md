# Campus Food Vendor Pre-Order System
## Project Contract, Delivery Phases, and Sprint Plan

**Version:** 1.0  
**Contract date:** 2026-09-17  
**Project status:** Functional frontend prototype; backend and production integration pending  
**Primary repository:** `CS-Campus-Food-Vendor-Pre-Order-System-`

---

## 1. Contract Purpose

This document is the shared agreement for what the Campus Food Vendor Pre-Order System is intended to solve, what will be delivered, how delivery will be sequenced, and what conditions must be met before each phase is accepted.

This is a living delivery contract. When requirements change, the change must be recorded in the change log and reflected in the affected phase, sprint, acceptance criteria, and technical design.

---

## 2. Product Problem

Campus food vendors experience long queues during peak periods. Students often cannot see what food is available, whether a vendor is open, how long preparation will take, or whether an item will still be available before deciding where to eat.

The system will provide one campus food ordering workflow where:

- Students discover vendors and available menu items.
- Students see useful preparation and collection information before ordering.
- Students place pre-orders for a selected collection time.
- Vendors manage their menu and receive incoming orders.
- Vendors update order progress so students know when to collect.
- Campus operations can monitor the health of the marketplace and resolve issues.

### Primary outcome
Reduce peak-time queues and uncertainty by moving food discovery, ordering, and collection coordination into a single campus platform.

### Success indicators
The production system should be able to measure:

- Average student ordering time from vendor discovery to confirmation.
- Average vendor order acknowledgement time.
- Average order preparation time.
- Percentage of orders collected within the selected collection window.
- Queue or waiting-time reduction during agreed peak periods.
- Order cancellation, refund, and no-show rates.
- Student and vendor satisfaction.

---

## 3. Users and Roles

### Student

A student can:

- Register and verify an account.
- Sign in and manage a profile.
- Browse vendors and filter/search their offerings.
- View menus, prices, item availability, ratings, and estimated preparation time.
- Build an order and select a collection time.
- Submit, view, and track an order.
- Receive status updates.
- Collect an order and optionally rate the experience.

### Vendor

A vendor can:

- Register and maintain a vendor profile.
- Sign in to a vendor workspace.
- Create, edit, disable, and remove menu items.
- Set prices, categories, descriptions, and availability.
- View incoming orders.
- Accept or reject orders.
- Move orders through preparation and collection states.
- View operational summaries and order history.

### Campus administrator or operations user

An administrator can:

- Approve, suspend, or manage vendors.
- Manage student and vendor accounts.
- Review orders and operational activity.
- Resolve disputes, cancellations, refunds, or incidents.
- Configure campus-wide settings, collection locations, and operating hours.
- View reporting and service-level metrics.

The administrator role is part of the target product scope but is not present in the current prototype.

---

## 4. Product Scope

### In scope

- Responsive web application for students and vendors.
- Account registration, login, email verification, password recovery, and password reset.
- Role-based student and vendor experiences.
- Vendor discovery and menu browsing.
- Cart and pre-order checkout.
- Collection-time selection.
- Order lifecycle and status tracking.
- Vendor menu and order management.
- Notifications for important order and account events.
- API, database, authorization, validation, logging, and deployment.
- Operational reporting needed to evaluate the queue-reduction objective.

### Out of scope for the first production release unless explicitly approved

- Native iOS or Android applications.
- Delivery outside campus collection points.
- Open marketplace access outside the institution.
- Complex loyalty, rewards, or subscription programs.
- Multi-campus tenancy.
- Advanced recommendation or personalization models.
- Cashless payment hardware integration.

---

## 5. Current Implementation Baseline

### Implemented frontend prototype

The `client` application uses Next.js 16, React 19, TypeScript, Tailwind CSS v4, and Lucide icons. It currently includes:

- Root route redirecting to `/student/dashboard` for direct prototype access.
- Auth routes: `/login`, `/register`, `/forgot-password`, `/verify-email`, and `/reset-password`.
- Student routes: dashboard, vendors, vendor menu detail, orders, new order, and profile.
- Vendor routes: dashboard, menu, orders, and profile.
- Reusable authentication components and validation helpers.
- Reusable dashboard layout, sidebar, header, statistics cards, and status badges.
- Lavender and purple visual language shared across auth and dashboard surfaces.
- Mock vendors, menu items, statistics, and order records in `client/lib/dashboard-data.ts`.

### Current backend baseline

The `server` application now has a persistent student-ordering vertical slice:

- PostgreSQL is configured through `DATABASE_URL`; `server/migrations/001_initial_schema.sql` creates the initial schema and is tracked in `schema_migrations`.
- Registration persists users with scrypt-hashed passwords. Login creates an expiring, database-backed `HttpOnly` session cookie; protected APIs enforce student/vendor roles.
- The API seeds the prototype vendor/menu catalog and rolling collection slots, and returns only available menu items for checkout.
- Vendors can list, add, edit, and remove their own menu items through authenticated API routes. Items already referenced by orders are retired by setting them unavailable, preserving order history.
- Student checkout persists order/item snapshots, validates availability and collection slots, computes the service fee and totals server-side, and gives 20% off the food subtotal on the first successfully created order only.
- Vendor order lists and allowed status transitions are persisted; student and vendor order views refresh from the API.
- `npm --prefix server test` runs a database-backed integration test for first-order eligibility, retries, concurrent submissions, and account isolation.
- Email verification, password recovery, payments, notifications, and administrator APIs are not integrated.

### Current prototype limitations

- The API requires a PostgreSQL `DATABASE_URL`; local setup is documented in `README.md`.
- Student/vendor page navigation is not itself protected; data-changing and order APIs enforce the server session and role.
- Vendor discovery, most dashboard metrics, profile editing, email verification, and password recovery remain prototype-only or unconfigured.
- Payment, refund, notification, audit, and administrator workflows are not implemented.
- Automated browser, accessibility, and performance test suites are not present.

The prototype is accepted as a design and interaction baseline, not as a production-ready ordering system.

---

## 6. Target Architecture

### Frontend

- Next.js App Router with TypeScript.
- Shared components for authentication, navigation, forms, orders, menu items, and feedback states.
- Server-backed data fetching with clear loading, empty, error, and success states.
- Role-aware routing and client interaction only where needed.
- Accessible semantic controls and keyboard navigation.

### Backend

- Express REST API, or an approved equivalent API boundary.
- Layered structure: routes, controllers, services, validation, persistence, and authorization.
- Central error handling and request logging.
- Secure authentication with hashed passwords, expiring tokens or secure sessions, and role checks.
- API versioning policy established before production integration.

### Data storage

PostgreSQL is selected for the current backend slice and uses versioned SQL migrations. The production deployment still needs an approved hosting/operations decision. At minimum, the model must support:

- Users and roles.
- Student profiles.
- Vendor profiles and operating hours.
- Menus, categories, prices, availability, and item history.
- Orders, order items, totals, collection times, and status history.
- Notifications.
- Ratings or feedback.
- Audit events.

### External services

The implementation must explicitly choose and document services for:

- Email verification and password recovery.
- Payment processing, if required by the institution.
- Transactional notifications.
- Hosting and monitoring.

---

## 7. Order Lifecycle Contract

The canonical order state machine is:

`Pending -> Confirmed -> Preparing -> Ready for Collection -> Collected`

Alternative terminal states:

- `Cancelled`
- `Rejected`
- `Refunded` when payment has been captured
- `Expired` when the collection window passes without collection, if approved by operations

Rules:

- Every state transition must be authorized by the correct role.
- Every transition must be timestamped.
- A student must see the current state and the next expected action.
- A vendor must not receive an order without the required item, price, quantity, and collection data.
- The system must prevent orders for unavailable items or closed vendors.
- Cancellation and refund rules must be explicit before payment integration is released.

---

## 8. Delivery Phases and Sprints

The plan assumes two-week sprints. A sprint may be shortened or extended only through the change-control process. Each sprint ends with a demonstration, acceptance review, and updated risk/status record.

### Phase 0: Product Alignment and Technical Foundation

**Goal:** Confirm the problem, scope, architecture, and release constraints before production implementation.

#### Sprint 0.1 - Product Contract and User Journeys

**Deliverables**

- Approved product contract.
- Student, vendor, and administrator journey maps.
- Defined MVP versus post-MVP scope.
- Order lifecycle and cancellation policy draft.
- Initial success metrics and analytics events.

**Acceptance criteria**

- Product owner approves the problem statement and target users.
- The team can trace each MVP requirement to a planned sprint.
- Ambiguous decisions have an owner and due date.

#### Sprint 0.2 - Architecture and Environment Setup

**Deliverables**

- Backend architecture decision.
- Database and hosting decision.
- Environment variable inventory.
- Development, test, staging, and production environment plan.
- API naming and error-response conventions.
- Branching, review, and release workflow.

**Acceptance criteria**

- A new developer can run client and server locally using documented commands.
- Secrets are excluded from source control.
- The selected persistence and deployment approach is recorded.

---

### Phase 1: Identity, Security, and Access

**Goal:** Replace prototype auth stubs with secure, persistent identity and role-based access.

#### Sprint 1.1 - User and Role Data Model

**Deliverables**

- User, student, vendor, and role schemas.
- Database migrations and seed strategy.
- Password hashing and credential policy.
- Input validation shared between API boundaries and domain services.

**Acceptance criteria**

- Duplicate email addresses are rejected safely.
- Passwords are never stored or logged in plain text.
- Student and vendor profiles are linked to one identity without duplicated credentials.

#### Sprint 1.2 - Registration, Verification, and Login

**Deliverables**

- `POST /api/auth/register`.
- `POST /api/auth/login`.
- Email verification flow.
- Secure session or token issuance.
- Logout and session invalidation.
- Frontend integration for student and vendor registration.

**Acceptance criteria**

- A student and vendor can register through the UI.
- Unverified accounts cannot use protected ordering capabilities.
- Invalid credentials return a safe, consistent error.
- Successful login redirects users to the correct role dashboard.

#### Sprint 1.3 - Password Recovery and Route Protection

**Deliverables**

- Forgot-password request endpoint.
- Expiring reset token flow.
- Password reset endpoint and UI integration.
- Protected route middleware.
- Role-based access checks for student and vendor routes.

**Acceptance criteria**

- Password reset tokens expire and cannot be reused.
- A student cannot access vendor management routes.
- A vendor cannot access another vendor's private data.
- Unauthenticated users are redirected to the intended login flow.

---

### Phase 2: Vendor and Menu Management

**Goal:** Make the vendor catalog a real, reliable source of available food information.

#### Sprint 2.1 - Vendor Profiles and Operating Rules

**Deliverables**

- Vendor profile API and database records.
- Vendor approval/status model.
- Operating hours and open/closed calculation.
- Collection locations and preparation-time settings.

**Acceptance criteria**

- Only approved vendors appear in student discovery.
- Open/closed status is computed from persisted rules.
- Vendors can update permitted profile fields.

#### Sprint 2.2 - Menu CRUD and Availability

**Deliverables**

- Menu item create, read, update, and archive endpoints.
- Categories, prices, descriptions, and optional images.
- Availability toggle.
- Vendor menu management UI connected to the API.

**Acceptance criteria**

- A vendor can add, edit, disable, and archive an item.
- Disabled items cannot be added to a new order.
- Price and availability changes are reflected in student browsing.
- Existing orders retain their historical item price and description.

#### Sprint 2.3 - Student Discovery and Menu Browsing

**Deliverables**

- Vendor listing endpoint.
- Vendor detail and menu endpoint.
- Search, category filtering, open-now filtering, and sorting.
- Empty, loading, error, and unavailable states.
- Student vendor and menu pages connected to real data.

**Acceptance criteria**

- Students can find a vendor and view its current menu without stale mock data.
- Search and filters produce correct results.
- Unavailable vendors and items are clearly represented.
- The pages remain usable on mobile and desktop widths.

---

### Phase 3: Cart, Checkout, and Order Creation

**Goal:** Turn menu browsing into a reliable pre-order workflow.

#### Sprint 3.1 - Cart and Order Validation

**Deliverables**

- Persistent or session-based cart model.
- Quantity controls and item removal.
- Vendor consistency rules, if orders cannot span vendors.
- Price, availability, quantity, and minimum/maximum validation.

**Acceptance criteria**

- Students can add available items, change quantity, and remove items.
- Totals are calculated from server-approved values.
- The system prevents checkout with unavailable or invalid items.

#### Sprint 3.2 - Collection Time and Order Submission

**Deliverables**

- Collection slot availability model.
- Order creation endpoint.
- Order item snapshots and totals.
- Collection location and time selection.
- Confirmation screen and order reference.

**Acceptance criteria**

- A student can submit a valid order with a collection time.
- The server recalculates totals and never trusts client totals.
- A successful order receives a unique reference.
- The vendor sees the order after creation.

#### Sprint 3.3 - Payment and Failure Handling

**Deliverables**

- Approved payment strategy, or explicit pay-on-collection workflow.
- Payment authorization/capture integration where required.
- Failure, retry, cancellation, and refund handling.
- Checkout confirmation and error recovery states.

**Acceptance criteria**

- A failed payment cannot create a falsely paid order.
- A retried request cannot create duplicate orders or charges.
- Users receive an actionable result for success, failure, and pending payment.

---

### Phase 4: Vendor Fulfilment and Student Tracking

**Goal:** Coordinate preparation and collection so students and vendors share the same order truth.

#### Sprint 4.1 - Vendor Order Queue

**Deliverables**

- Vendor order list and detail endpoints.
- Accept/reject actions.
- Preparation workflow controls.
- Vendor filtering by status and collection time.

**Acceptance criteria**

- Vendors can see only their orders.
- Authorized vendor actions enforce valid state transitions.
- Rejecting an order records a reason and triggers the defined customer outcome.

#### Sprint 4.2 - Student Order Tracking

**Deliverables**

- Student order list and detail endpoints.
- Timeline/status display.
- Collection instructions and location.
- Cancel-order rules where allowed.

**Acceptance criteria**

- Students see current status without relying on static mock data.
- Status history is ordered and timestamped.
- The UI explains what the student should do next.

#### Sprint 4.3 - Notifications and Collection Confirmation

**Deliverables**

- In-app notification model.
- Email or approved channel notifications for confirmation, ready, cancellation, and failure.
- Collection confirmation action, QR/reference option, or approved alternative.
- No-show and late-collection policy.

**Acceptance criteria**

- Important order events produce the expected notification.
- A vendor can mark an order collected only through an authorized workflow.
- Duplicate notifications are avoided or safely deduplicated.

---

### Phase 5: Profiles, Administration, and Operations

**Goal:** Provide the controls required to operate the system responsibly on campus.

#### Sprint 5.1 - Profile and Account Settings

**Deliverables**

- Student profile editing.
- Vendor profile editing.
- Email/password change flow.
- Account deactivation policy.

**Acceptance criteria**

- Users can update allowed profile details and see saved values after refresh.
- Sensitive changes require appropriate re-authentication or verification.

#### Sprint 5.2 - Administrator Workspace

**Deliverables**

- Administrator role and protected routes.
- Vendor approval, suspension, and reactivation.
- User management and order lookup.
- Operational incident and dispute workflow.

**Acceptance criteria**

- Administrator actions are permission-checked and audited.
- Suspended vendors cannot accept new orders.
- Support staff can trace an order from creation to collection or cancellation.

#### Sprint 5.3 - Reporting and Service Metrics

**Deliverables**

- Operational dashboard.
- Order volume, preparation time, collection performance, and cancellation metrics.
- Export or reporting mechanism approved by the institution.
- Analytics event catalogue and privacy review.

**Acceptance criteria**

- Metrics use defined formulas and time windows.
- Reports can be reconciled against stored orders.
- Personal data is minimized in reports and exports.

---

### Phase 6: Quality, Security, Accessibility, and Release Readiness

**Goal:** Prove that the system is safe, usable, reliable, and deployable.

#### Sprint 6.1 - Automated Testing and Regression Coverage

**Deliverables**

- Unit tests for validation, totals, state transitions, and authorization.
- API integration tests.
- End-to-end tests for registration, login, browsing, checkout, fulfilment, and collection.
- CI checks for typecheck, lint, tests, and build.

**Acceptance criteria**

- Critical user journeys pass in a clean environment.
- Regression tests cover each production incident discovered during development.
- The build fails on type, lint, or test regressions.

#### Sprint 6.2 - Security, Accessibility, and Performance Review

**Deliverables**

- Dependency and secret scan.
- Authorization and input validation review.
- Accessibility audit for keyboard use, labels, focus, contrast, and screen readers.
- Performance checks for mobile and slow network conditions.
- Backup, retention, and incident-response review.

**Acceptance criteria**

- No known critical authorization or secret-management issue remains open.
- Core workflows meet the agreed accessibility target.
- Core pages meet the agreed performance budget.

#### Sprint 6.3 - Staging Pilot and Production Launch

**Deliverables**

- Staging deployment with production-like configuration.
- Vendor and student pilot group.
- Runbook, support process, rollback plan, and monitoring.
- Production release and post-launch review.

**Acceptance criteria**

- Pilot users complete the core journeys without blocking defects.
- Monitoring and alerts are active before launch.
- Rollback has been tested or technically proven.
- Product owner signs the release checklist.

---

## 9. Cross-Cutting Requirements

These requirements apply to every phase:

- **Security:** Validate all input server-side, enforce least privilege, protect secrets, hash passwords, and avoid sensitive data in logs.
- **Privacy:** Collect only necessary student/vendor information and define retention and deletion rules.
- **Accessibility:** Use semantic HTML, labels, visible focus, keyboard operation, meaningful errors, and sufficient contrast.
- **Responsive design:** Support the agreed mobile, tablet, and desktop breakpoints.
- **Reliability:** Handle network failure, retries, duplicate requests, stale data, and partial service outages.
- **Observability:** Log actionable technical events with correlation identifiers while excluding secrets and unnecessary personal data.
- **Data integrity:** Use server-authoritative prices, availability, totals, permissions, and order transitions.
- **Documentation:** Update API, setup, environment, deployment, and support documentation as implementation changes.
- **Testing:** Add focused tests with each behavior change; do not rely only on visual inspection or mock assertions.
- **Design consistency:** Preserve the established Campus Eats lavender/purple visual identity unless an approved design decision changes it.

---

## 10. Definition of Done

A backlog item is done only when:

- The behavior is implemented in the correct ownership layer.
- Validation and authorization rules are present where applicable.
- Loading, empty, success, and error states are handled.
- The implementation is responsive and accessible for the affected flow.
- Tests are added or updated at the appropriate level.
- Lint, typecheck, tests, and build pass for the affected project.
- Documentation and environment requirements are updated.
- The change is demonstrated and accepted by the product owner.

A phase is done only when all sprint acceptance criteria are met and no unresolved critical or high-severity issue blocks the phase outcome.

---

## 11. Release Gates

### Prototype gate

- Main student and vendor screens are demonstrable.
- Visual direction and navigation are approved.
- Mock data is clearly identified as non-production.

### MVP gate

- Auth, menu discovery, checkout, vendor fulfilment, and order tracking work end to end against a real backend.
- Role authorization and persistent data are active.
- Critical automated tests pass.
- Payment or pay-on-collection policy is approved.

### Pilot gate

- Staging environment is stable.
- Selected vendors and students complete real-world trial orders.
- Support, monitoring, notification, and rollback processes are ready.

### Production gate

- Security, accessibility, privacy, and performance reviews are accepted.
- Data backup and recovery approach is verified.
- Product owner signs the release checklist.

---

## 12. Known Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Vendor availability changes faster than students can see | Failed or disappointing orders | Server-side availability checks, short-lived cache, vendor toggle, and clear timestamps |
| Peak demand overloads preparation capacity | Longer queues and late orders | Collection slots, order caps, preparation estimates, and operational metrics |
| Payment succeeds but order creation fails | Financial and support incident | Idempotency keys, transaction reconciliation, and explicit pending-payment state |
| Unauthorized access to role data | Privacy and operational risk | Server-side role checks, object-level authorization, audit logs, and security tests |
| Notifications are delayed or duplicated | Missed collections and confusion | Queue/retry policy, deduplication keys, and in-app status as source of truth |
| Static prototype assumptions leak into production | Incorrect pricing or availability | Remove mock data behind API integration tests before MVP acceptance |
| Scope expands before core workflow is reliable | Delayed release | Protect MVP gates and use change control for post-MVP features |

---

## 13. Change Control

Any request that changes product scope, user roles, order rules, payment behavior, data collection, or release timing must record:

1. The requested change and reason.
2. The affected user journey and acceptance criteria.
3. The technical, privacy, security, and support impact.
4. The phase or sprint impact.
5. The decision owner and approval date.

No change is considered part of the contract until it is approved and added to the change log.

---

## 14. Current Priority Order

1. Establish the backend and database foundation.
2. Implement secure authentication and route protection.
3. Replace mock vendor/menu data with real API-backed data.
4. Complete cart, checkout, and order creation.
5. Implement vendor fulfilment and student tracking.
6. Add notifications, payment policy, and collection confirmation.
7. Add administrator operations and reporting.
8. Complete automated testing, security review, pilot, and production release.

---

## 15. Change Log

| Date | Change | Owner | Status |
|---|---|---|---|
| 2026-09-17 | Initial project contract created from the existing repository and prototype state. | Project team | Approved for planning |

---

## 16. Approval

By approving this contract, the project stakeholders agree that:

- The campus queue and food-availability problem is the central product outcome.
- The current frontend is a prototype baseline and not a production implementation.
- The phases and sprint acceptance criteria are the default delivery sequence.
- Changes will be documented rather than silently changing the project boundary.

**Product owner:** ____________________  
**Technical owner:** ____________________  
**Operations representative:** ____________________  
**Approval date:** ____________________
