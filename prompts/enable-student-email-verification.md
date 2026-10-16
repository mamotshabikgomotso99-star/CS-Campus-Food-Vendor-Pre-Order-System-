# Enable Student Email Verification

## Objective
Implement a real email verification flow for newly registered student accounts using the existing Express, PostgreSQL, and SMTP infrastructure. A student must confirm the email address before signing in.

## Current behavior
- `client/components/auth/RegisterForm.tsx` registers a student and navigates to `/verify-email` without carrying the student's email address.
- `client/components/auth/VerifyEmailForm.tsx` sends a verification request for the hard-coded address `student@campus.edu`.
- `POST /api/auth/verify-email` in `server/app.js` always returns a prototype-only success message.
- The `users` schema has no email verification state or verification token table, and login does not enforce verification.
- `server/email.js` already configures Nodemailer from private SMTP environment variables for password reset. Reuse this configured service and `CLIENT_URL`; do not add a second provider or expose SMTP values.

## Required implementation
1. Add a forward-only migration for a nullable `users.email_verified_at` field and a verification-token table containing user ID, unique token hash, expiry, use timestamp, and creation timestamp. Register the migration in `server/database.js`. Backfill existing users as verified so the rollout does not lock out accounts created before this feature; require verification for new student registrations.
2. On student registration, persist the user and a cryptographically random, single-use verification token with a bounded expiry (24 hours). Store only a SHA-256 hash of the token. Send a link to the frontend `/verify-email?token=...` using the existing SMTP configuration. Revoke older unused verification tokens when issuing a replacement.
3. Implement `POST /api/auth/confirm-email` to atomically validate an unexpired, unused token, set `email_verified_at`, and consume the token. Reject invalid, expired, and reused tokens without changing account state.
4. Implement `POST /api/auth/verify-email` as a resend request accepting an email address. Return the same generic success response for existing, missing, and already-verified accounts to prevent account enumeration. For an existing unverified student, issue a fresh token and send the link. Rate-limit resend and confirmation attempts.
5. Block login for an unverified student only after validating the password; return a stable response the client can use to offer verification/resend. Do not create a session for that attempt. Leave vendor provisioning and existing admin behavior unchanged.
6. Update the registration flow to send the actual student email to the verification page. Make that page consume the token from the link, show clear loading/success/error/expired states, and offer resend for the supplied email instead of using a hard-coded address. Provide a path to resend from the unverified-login state as well.
7. Keep SMTP configuration server-side and reuse the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`/`EMAIL_FROM`, and `CLIENT_URL` settings. Never return or log raw tokens, passwords, SMTP credentials, or mail content. Keep verification endpoints consistent with `{ success: false, message: "..." }` API errors.
8. Add focused tests using an injected mailer; tests must not send real email. Cover registration delivery, generic resend responses, confirmation success, expired/reused tokens, login denial before verification and success after verification, and session creation only after verification.

## Constraints
- Do not change already-applied migrations; add a new numbered migration.
- Do not make unverified accounts able to authenticate or access protected routes.
- Preserve existing accounts during migration by marking them verified; only newly registered student accounts require email confirmation.
- Do not alter vendor account provisioning or implement unrelated auth/payment changes.
- Do not add SMTP credentials to client environment variables, source files, prompts, tests, or logs.

## Verification
- Run focused auth tests and the complete server test suite.
- Run the client typecheck, lint, and build checks available in the repository.
- Verify an unverified student cannot sign in, a valid link enables sign-in exactly once, and resend behavior does not reveal whether an address is registered.
- Provide exact local test steps, including how to use an injected/mock mailer when SMTP is not configured; do not expose credentials.