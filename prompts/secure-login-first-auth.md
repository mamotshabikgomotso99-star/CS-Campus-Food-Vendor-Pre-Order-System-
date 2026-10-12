# Secure Login-First Authentication Implementation

Implement the login-first auth flow for Campus Eats using the existing Next.js + Express codebase without redesigning the app or breaking current functionality.

## Current codebase inspection summary
- Frontend is a Next.js App Router app under `client/` with auth pages for login, register, forgot/reset password, and protected student/vendor dashboards.
- Backend is an Express app under `server/` with session-based auth, CORS, and PostgreSQL-backed user/session storage.
- The project already includes a basic cookie-based session flow, `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, and `POST /api/auth/logout`.
- The root route currently redirects unauthenticated users to the student dashboard instead of `/login`.
- Protected dashboard pages are not yet enforcing the app-level login-first guard.
- The server already protects many private routes with a session-based `requireRole` middleware, but the frontend route protection and public/private separation should be tightened so the login flow is consistent and login is the first page.

## Required implementation
1. Redirect unauthenticated visitors from `/` to `/login`.
2. Protect all private frontend routes so unauthenticated users are redirected to `/login` before accessing student/vendor pages.
3. Ensure users already logged in are redirected away from `/login` to their correct dashboard.
4. Preserve the current Campus Eats styling and authentication UI.
5. Review backend auth middleware and ensure protected API routes remain independently secured with HTTP 401/403 responses.
6. Keep public routes allowlisted and avoid protecting login/register/forgot/reset endpoints with the same private guard.
7. Fix the actual frontend/backend connectivity issue by validating the configured API URL env vars, CORS rules, and deployed origin handling.
8. Add or update the relevant tests for login-first routing, protected route access, invalid credentials, and unauthorized access.
9. Run the existing relevant checks, fix regressions, and report the exact verification results.

## Constraints
- Do not delete or overwrite existing user data or database tables.
- Keep the current UI design intact unless absolutely required.
- Use secure server-side session/auth logic; do not rely only on client-side state.
- Do not store tokens in localStorage/sessionStorage.
- Keep the app working locally while preserving the configured deployment model.

## Deliverables
- Code changes in the existing files only where needed.
- Tests updated/added for auth and access control.
- A concise implementation report with what was wrong, what changed, and how to deploy safely.
