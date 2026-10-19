# Configure SMTP Password Reset

Implement a complete, secure email-based password-reset flow for the existing Campus Eats Next.js + Express + PostgreSQL application. SMTP is the chosen external email service. Follow the current project patterns and preserve the existing auth styling.

## Current behavior
- `POST /api/auth/forgot-password` currently returns a prototype-only message and does not send email.
- `POST /api/auth/reset-password` currently returns HTTP 501.
- The reset page currently accepts an email and new password directly; it must instead require the reset token from the emailed link.
- Passwords are hashed server-side using the existing scrypt helpers. Authenticated sessions are persisted in PostgreSQL.
- SMTP and email verification are not currently configured.

## Required implementation
1. Add an SMTP mail transport using Nodemailer or another suitable established Node.js mail library. Keep SMTP configuration server-side only.
2. Read SMTP configuration from private server environment variables, documented without real credentials:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`
   - Reuse `CLIENT_URL` as the public frontend origin for reset links.
3. Add a forward-only database migration for password reset tokens. Store only a hash of each random token, its user, expiry, creation, and use state. Ensure tokens are single-use and expire after a short period, such as 30 minutes. Revoke older outstanding reset tokens when a new request is issued.
4. Implement `POST /api/auth/forgot-password`:
   - Validate the email format and throttle requests appropriately.
   - Return the same generic success message whether or not the email belongs to an account, avoiding account enumeration.
   - For an existing account, generate a cryptographically random token, persist its hash and expiry, and email a link to `${CLIENT_URL}/reset-password?token=...`.
   - Never log reset tokens or SMTP credentials. Do not expose them through API responses.
5. Implement `POST /api/auth/reset-password`:
   - Accept token, new password, and confirmation, not an email as the proof of identity.
   - Atomically validate the token hash, unused state, and expiry; update the password using the existing hash helper; mark the token used; and revoke all sessions for that user.
   - Return clear validation errors without revealing user/account existence.
6. Update the reset form to read the token from the URL, submit it with the new password, show loading/error/success states, and remove the email-only reset path.
7. Keep secrets in `server/.env` or hosting environment configuration only. Do not read, print, commit, or expose existing secret values. Document setup, local SMTP testing, and deployment environment configuration in README.
8. Add tests for unknown email generic responses, SMTP send behavior through an injected/mock mailer, token expiry/reuse rejection, password update, session revocation, and validation failures. Tests must not send real email.

## Constraints
- Do not implement unauthenticated password changes based only on an email address.
- Do not store raw reset tokens in the database or logs.
- Do not put SMTP credentials or tokens in client environment variables.
- Keep unrelated auth behavior unchanged; email verification remains unconfigured unless explicitly required.
- Use new numbered SQL migrations; never edit migrations already applied to user databases.

## Verification
- Run the focused auth tests, full server tests, frontend typecheck, lint, and build.
- Verify the reset request returns a generic response and sends a link only when an account exists.
- Verify valid token changes the password exactly once and invalidates existing sessions.
- Provide exact local SMTP setup and reset test steps without exposing any credentials.
