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

## Deploy the API on Render

The frontend can remain on Vercel while the Express API runs as a separate Render web service. The root `render.yaml` defines the API service and prompts for `DATABASE_URL` and `CLIENT_URL` without storing their values in Git.

1. Push the repository to your Git provider and create a Render Blueprint from it.
2. For `DATABASE_URL`, enter a production PostgreSQL connection string in Render's secure configuration. Do not use a local database URL or commit the value.
3. For `CLIENT_URL`, enter the exact frontend origin, without a trailing slash: `https://cs-campus-food-vendor-pre-order-sys-ten.vercel.app`.
4. Deploy the Blueprint. Check `https://<render-service-host>/api/health`; it should return `{"success":true,"status":"ok"}` when the API and database are reachable.
5. In Vercel project settings, set `NEXT_PUBLIC_API_URL` to the Render API base URL, such as `https://campus-eats-api.onrender.com` (no `/api` suffix), for the required environments, then redeploy the frontend.
6. Confirm the browser sends API requests to the Render host and that the API returns the configured CORS origin and `Access-Control-Allow-Credentials: true` for credentialed requests.

The Blueprint uses Render's free web-service plan to avoid provisioning a paid service without approval. Free services can sleep while idle. A production launch needs an explicitly selected database and hosting plan, verified backup/recovery, and review of cross-site session-cookie behavior for the chosen frontend and API domains.

## First-order discount

The first successfully created student order receives 20% off its food subtotal. The service fee is excluded. Eligibility, availability, prices, and totals are checked by the API. Failed checkouts do not consume the offer; later cancellations do not restore it.

## Checks

```powershell
npm --prefix server test
npm --prefix client run lint
npm --prefix client run build
```

The server integration test creates uniquely named test accounts, vendors, menu items, and orders, then removes them afterward. Run it only against a development/test database configured for `DATABASE_URL`, never production.

## Prototype limitations

Email verification and password recovery are not connected to an email service. Payments, notifications, production hosting, and some vendor discovery/profile/dashboard features remain unimplemented. The menu catalog starts with prototype seed items; vendor edits are persisted, and menu prices and availability used at checkout are server-owned.
