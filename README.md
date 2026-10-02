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
