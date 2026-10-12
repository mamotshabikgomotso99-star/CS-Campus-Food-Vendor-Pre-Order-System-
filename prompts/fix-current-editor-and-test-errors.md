# Fix Current Editor and Test Errors

## Objective
Resolve the current syntax diagnostics and failing server integration test without weakening account provisioning or touching unrelated work.

## Verified errors
- `server/scripts/create-vendor-login.js` contains an accidentally pasted Express CORS setup (`require('cors')`, `app.use(...)`, `express.json()`) and the shell command `npm install cors`. This file is an interactive CLI and does not define an Express app; the API CORS middleware is already correctly configured in `server/app.js`.
- `npm --prefix server test` fails in `server/test/orders.test.js`: `registerVendorAndLogin` expects public vendor registration to return `201`, but the API correctly rejects it with `403` because vendor accounts must be provisioned by an administrator.
- The server package has `cors@2.8.6` installed. The 10 non-database server tests pass; the DB-backed order test reached the real configured database and failed at the stale vendor setup. Its fixture cleanup must remain reliable.

## Work after approval
1. Remove only the pasted CORS/Express block and shell command from `server/scripts/create-vendor-login.js`; preserve the existing terminal prompts, secure password entry, provisioning flow, and exports.
2. Update the order integration test to create unique temporary vendor profiles and provision their accounts through `createVendorLogin` from `server/vendor-provisioning.js`, then log in through the API as before. Do not re-enable public vendor registration.
3. Ensure all temporary vendor rows, accounts, sessions, menu items, collection slots, orders, and related history created by the integration test are removed in cleanup, including when setup or assertions fail.
4. Validate the CLI with `node --check server/scripts/create-vendor-login.js`, run the isolated API tests, then run the DB-backed test only if `DATABASE_URL` is confirmed to point to a disposable development/test database. Never run it against production.
5. Run `npm --prefix server test` and report exact pass/fail counts. Do not alter the current CORS policy or add duplicate dependencies.

## Constraints
- Follow `AGENTS.md` and `PROJECT_CONTRACT.md`; no unrelated refactors.
- Do not print or request database credentials, emails, student numbers, or passwords.
- Do not commit, deploy, or change production data.
- Preserve vendor-account administrator provisioning as the security boundary.
