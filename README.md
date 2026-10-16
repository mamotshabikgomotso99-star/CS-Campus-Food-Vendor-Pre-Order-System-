# CS-Campus-Food-Vendor-Pre-Order-System-
Campus Eats lets students pre-order meals from campus vendors for collection.

## Local setup

Requirements: Node.js 20.12 or newer and a PostgreSQL database.

Configure `server/.env` with `DATABASE_URL`, `PORT=5000`, and `CLIENT_URL=http://127.0.0.1:3000` (or the client origin you use). Configure `client/.env.local` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:5000`. Keep both environment files out of source control and never paste their contents into logs or chat.

Start the API and web client in separate terminals from the repository root:

```powershell
npm --prefix server start
npm --prefix client run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000`. The API applies versioned SQL migrations from `server/migrations/` at startup and seeds the prototype menu and collection slots.

## Admin and vendor onboarding

Vendors apply at `/vendor/apply`; accounts remain pending until approved by an admin. To bootstrap an administrator on a fresh database, set `ADMIN_EMAIL`, `ADMIN_NAME`, and a unique `ADMIN_PASSWORD` of at least 12 characters in the private `server/.env`, then run `npm --prefix server run create-admin`. Admins sign in at `/admin/login` and review requests at `/admin/dashboard`. Admin registration is not public.

## TUT Soshanguve South vendor map

Students see the vendor map directly on `/student/dashboard` and can switch to **Map** on `/student/vendors`. Vendors without saved coordinates remain listed with their collection-point text and are never placed at an estimated location. Map markers include a menu link and walking directions.

Admins can open **Vendor locations** from `/admin/dashboard` (or visit `/admin/locations`) and enter campus-confirmed latitude and longitude for an approved vendor. The API restricts saved coordinates to the TUT Soshanguve South campus boundary. Coordinates are intentionally not seeded; an admin must confirm each collection point before it appears on the student map.

The map uses the OpenStreetMap standard raster tile endpoint by default and shows required attribution. Its center and bounds are based on [OpenStreetMap way 413120107](https://www.openstreetmap.org/way/413120107). `NEXT_PUBLIC_MAP_TILE_URL` can point to another compatible tile provider. The community OSM tile service is best-effort, has no service-level agreement, and prohibits bulk/offline tile downloads; use normal interactive viewing only. For production traffic, select a tile provider or hosting plan suitable for expected usage.

## SMTP email delivery

Copy the SMTP placeholders from `server/.env.example` into the private `server/.env` and replace them with credentials from your SMTP provider. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` (or `SMTP_FROM`). For port 587 use `SMTP_SECURE=false` with STARTTLS; for port 465 use `SMTP_SECURE=true`. The sender address must be authorized by the provider. Keep all SMTP values out of `client/.env.local` and source control.

Set `CLIENT_URL` to the exact browser-facing origin, for example `http://127.0.0.1:3000` locally or your deployed HTTPS origin. Password-reset links are valid for 30 minutes; student email-verification links are valid for 24 hours. Both are single-use. In production, new student accounts must verify their email before signing in; local non-production sign-in does not require verification. Existing accounts are preserved as verified by the migration. Restart the API after changing SMTP values. For local testing, use an SMTP sandbox/mail-catcher or a provider test inbox; do not use real customer accounts. On deployment, add the same SMTP values as private API-service environment variables and redeploy the API.

## Deploy the API on Render

The frontend can remain on Vercel while the Express API runs as a separate Render web service. The root `render.yaml` defines the API service and prompts for `DATABASE_URL` and `CLIENT_URL` without storing their values in Git.

For the Vercel project, set the Root Directory to `client`, use Node.js 22, and set `NEXT_PUBLIC_API_URL` to the public API base URL with no `/api` suffix. Configure it for every environment you intend to deploy, then redeploy after changing it.

1. Push the repository to your Git provider and create a Render Blueprint from it.
2. For `DATABASE_URL`, enter a production PostgreSQL connection string in Render's secure configuration. Do not use a local database URL or commit the value.
3. For `CLIENT_URL`, enter the exact frontend origin, without a trailing slash: `https://cs-campus-food-vendor-pre-order-sys-ten.vercel.app`.
4. Deploy the Blueprint. Check `https://<render-service-host>/api/health`; it should return `{"success":true,"status":"ok"}` when the API and database are reachable.
5. In Vercel project settings, set `NEXT_PUBLIC_API_URL` to the Render API base URL, such as `https://campus-eats-api.onrender.com` (no `/api` suffix), for the required environments, then redeploy the frontend.
6. Confirm the browser sends API requests to the Render host and that the API returns the configured CORS origin and `Access-Control-Allow-Credentials: true` for credentialed requests.

The Blueprint uses Render's free web-service plan to avoid provisioning a paid service without approval. Free services can sleep while idle. A production launch needs an explicitly selected database and hosting plan, verified backup/recovery, and review of cross-site session-cookie behavior for the chosen frontend and API domains.

**Authentication deployment blocker:** the current session cookie is `SameSite=Lax`. A Vercel `*.vercel.app` frontend calling a Render `*.onrender.com` API is cross-site, so browser credentialed `fetch` requests will not reliably send that cookie. Before enabling authenticated production workflows, choose same-site custom domains for the frontend and API, or approve and implement a cross-site cookie policy (`SameSite=None; Secure`) with appropriate CSRF protections. Do not treat a successful CORS preflight as proof that session cookies work.

## First-order discount

The first successfully paid student order receives 20% off its food subtotal. The service fee is excluded. Eligibility, availability, prices, and totals are checked by the API. Failed or expired payments do not consume the offer; later cancellations do not restore it.

## Stripe test checkout

Student orders use Stripe-hosted Checkout in test mode. Campus Eats never receives card details. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `server/.env` using test-mode values; live keys are rejected by this prototype. `CLIENT_URL` must be the frontend origin.

For local webhook testing, install and authenticate the Stripe CLI, then run this in a separate terminal:

```powershell
stripe listen --forward-to http://127.0.0.1:5000/api/payments/stripe/webhook
```

Copy the `whsec_...` value printed by the CLI directly into `server/.env` as `STRIPE_WEBHOOK_SECRET`, then restart the API. Do not commit or share either Stripe secret. Keep the CLI listener running while testing.

Sign in as a student, select a menu item and collection slot, and continue to payment. Use Stripe's test card `4242 4242 4242 4242`, any future expiry date, and any CVC. The student return page remains pending until the signed webhook arrives; the vendor sees the order only after verified payment. The cancel link returns to the open Checkout Session when available. Configure the deployed Stripe test webhook at `https://<api-host>/api/payments/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`.

This is test-mode integration only. Live payments, production webhooks, refunds, and operational approval remain outstanding.
Because refunds are not implemented, vendors cannot cancel a paid order in the prototype. Configure an explicit refund policy and provider refund flow before enabling cancellations or live payments.

## Checks

```powershell
npm --prefix server test
npm --prefix client run lint
npm --prefix client run typecheck
npm --prefix client run build
```

GitHub Actions runs the client lint, typecheck, and production build checks plus the server tests on pushes and pull requests. The database-backed order integration test is skipped in CI because no `DATABASE_URL` is supplied. Locally, that integration test creates uniquely named test accounts, vendors, menu items, and orders, then removes them afterward. Run it only against a disposable development/test database configured for `DATABASE_URL`, never production.

## Prototype limitations

Email verification and password recovery use the configured SMTP service. Production payments, refunds, notifications, production hosting, and some vendor discovery/profile/dashboard features remain unimplemented. The menu catalog starts with prototype seed items; vendor edits are persisted, and menu prices and availability used at checkout are server-owned.
