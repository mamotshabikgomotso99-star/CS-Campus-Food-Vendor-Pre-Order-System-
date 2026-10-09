# Deploy the Campus Eats API on Render

## Goal
Create the deployment configuration needed to host the Express API publicly on Render so the Vercel frontend can call it, without exposing credentials in the repository.

## Chosen provider
Render is the selected API host. Keep the existing Vercel frontend. Do not deploy, print, or commit secret values.

## Implementation
- Add a Render Blueprint for the `server` Node.js service with the correct build and start commands.
- Configure `DATABASE_URL` and `CLIENT_URL` as dashboard-provided secret/environment values (`sync: false` in the Blueprint). Do not read values from local `.env` files into the Blueprint.
- Set `NODE_ENV=production` in the Render service.
- Add a small API health endpoint suitable for Render health checks; it must not expose database credentials, account data, or internal errors.
- Ensure the API's credentialed CORS policy permits the exact Vercel origin `https://cs-campus-food-vendor-pre-order-sys-ten.vercel.app` via `CLIENT_URL`, without allowing arbitrary origins.
- Document deployment steps in `README.md`: deploy Blueprint, securely enter the existing production PostgreSQL URL and exact Vercel origin in Render, wait for the Render service URL, set Vercel `NEXT_PUBLIC_API_URL` to that public API base URL (without `/api`), then redeploy Vercel.
- Include smoke checks for API health, CORS preflight/login-origin headers, API reachability, and database migration/startup. Never perform a production registration or order as a test.
- Do not select or provision a paid database plan without the user's explicit cost approval. Use a securely configured existing PostgreSQL database unless the user separately approves creating a managed database resource.

## Verification
- Validate Render Blueprint syntax and server health route.
- Run relevant server tests and client lint/type/build checks.
- Confirm a preflight from the exact frontend origin returns credentialed CORS headers and an unapproved origin does not.
- Report the remaining manual dashboard steps and state clearly that deployment is not live until the user imports the Blueprint, configures secrets in provider dashboards, and deploys.
