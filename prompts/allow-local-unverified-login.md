# Allow Local Sign-In Without Email Verification

## Objective
Allow newly registered student accounts to sign in locally when SMTP email delivery is unavailable, while preserving mandatory email verification in production.

## Current behavior
- Student registration creates an account and attempts to send a 24-hour verification link.
- `POST /api/auth/login` rejects students whose `email_verified_at` is null with `EMAIL_NOT_VERIFIED`.
- The local SMTP host currently fails DNS lookup, so verification links cannot be delivered.
- The account database is currently empty after the user-approved reset; the vendor/menu catalog remains.

## Required implementation
1. Make the login verification check environment-aware: production (`NODE_ENV=production`) must always require verified email. Non-production may allow an unverified student to establish a normal session so local development can continue without SMTP. Do not add a client-controlled bypass or query/header flag.
2. Do not disable email verification tokens, expiry, confirmation, resend, or email delivery. When mail is configured, registration should still attempt delivery and report whether it succeeded.
3. Permit local registration when SMTP is absent or mail delivery fails, returning an honest delivery status; do not claim the account is verified. Keep production registration blocked when mandatory verification mail cannot be configured.
4. Preserve vendor sign-in rules, password checks, session cookies, role checks, and all other auth behavior.
5. Add server tests proving non-production unverified login succeeds, production rejects unverified login without issuing a session, verified production login succeeds, and signup handles unavailable SMTP without storing raw tokens or claiming verification.
6. Update README setup notes to clearly state that unverified sign-in is local-development behavior only and production continues to require a confirmed email.

## Constraints
- Never allow unverified sign-in in production, even if a bypass variable is set.
- Do not create a demo account, hard-code credentials, or weaken password checks.
- Do not log or expose SMTP values, passwords, raw verification tokens, or account secrets.
- Keep changes limited to auth configuration, focused tests, and directly relevant documentation.

## Verification
- Run focused auth tests and the full server suite.
- Run client typecheck and lint because auth response/UI behavior may be affected.
- Verify through the local UI that a new student account can sign in with a DNS-unavailable SMTP service, and verify production-mode tests still reject it until verified.
- Provide exact local test steps and state that production verification remains mandatory.
