# Fix Login API Fetch Error

## Objective
Fix the local student/vendor sign-in request failing with `Failed to fetch` when the frontend is opened at `http://127.0.0.1:3000`.

## Root Cause
- The frontend API base URL is configured for `http://localhost:5000`, but the Express API is not running during the failed request.
- The server's CORS fallback allows `http://localhost:3000`, which does not match the frontend's `http://127.0.0.1:3000` origin.

## Scope
- Align the local client/server origin settings so the configured frontend origin can call the configured API origin.
- Preserve environment-based configuration and do not use a permissive wildcard CORS policy.
- Keep authentication checks intact; do not add a demo account, bypass login, or reuse credentials shown in screenshots.
- Ensure the existing API start task is used when testing sign-in. Do not represent the in-memory prototype user store as persistent; newly restarted API processes have no previously registered accounts.
- Keep changes limited to local auth connectivity and any directly necessary developer setup notes.

## Acceptance Criteria
- With the client and API running locally, the login request reaches Express from `http://127.0.0.1:3000` without a browser CORS/network `Failed to fetch` error.
- The API still returns the expected authentication error for an unknown account or incorrect password, and accepts only a valid account created in the running API process.
- No credentials are added to source files, prompts, logs, or browser storage beyond existing behavior.
- Client lint/build checks pass, and the login request is verified in the browser or with a focused HTTP/CORS check.
