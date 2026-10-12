# Prepare Campus Eats for a Safe Deployment

## Objective
Resolve the repository-level build, configuration, and verification blockers needed to deploy the currently implemented Campus Eats feature slice to a staging or pilot environment. Do not represent the full product as production-ready while documented product and operational requirements remain incomplete.

## Execution constraints
- Follow the repository `AGENTS.md` and `PROJECT_CONTRACT.md`; preserve the established UI and avoid unrelated refactors.
- Do not commit, push, create a hosting project, or deploy without separate explicit approval.
- Never ask for, print, or commit secrets. Document required environment variable names and have the user enter values directly in provider secret settings.
- Do not run database-backed integration tests unless the configured `DATABASE_URL` is confirmed to target a disposable development/test database. Never run them against production.
- Do not change session-cookie policy or configure production CORS origins until the actual frontend/API domains and approved cookie strategy are known.
- Read the installed Next.js documentation relevant to any Next configuration change before editing it.

## Verified baseline
- `npm --prefix client run lint` exits successfully with six `@next/next/no-img-element` warnings and zero errors.
- Client TypeScript checking succeeds with `node ./client/node_modules/typescript/bin/tsc --noEmit -p ./client/tsconfig.json`.
- `npm --prefix client run build` succeeds. Next.js warns that it inferred the repository root from the root lockfile while the client has another lockfile.
- Ten isolated API tests pass. The database-backed order integration test was not run because the safety of the configured database target has not been confirmed.
- The existing Render Blueprint deploys the API only; the README describes deploying the frontend separately on Vercel.
- The documented Vercel/Render domains are cross-site, while the current session cookie uses `SameSite=Lax`. Verify the real deployment domains and browser behavior; do not assume credentialed cross-site fetches will carry that cookie.
- Email verification and recovery, payment/notification decisions, admin workflows, backups/recovery, and other full-production requirements remain documented limitations, not build errors. Keep these as explicit release blockers unless separately approved and scoped.

## Work after approval
1. Reproduce and fix concrete lint, typecheck, test, or production-build failures discovered by running the repository's checks. Keep warning-only cleanup limited to issues that affect deployment quality.
2. Remove the Next.js workspace-root ambiguity using a supported configuration consistent with the installed Next.js version; do not delete lockfiles without proving they are unnecessary.
3. Add or update CI to install the client and server independently and run safe lint, typecheck, isolated API tests, and production build checks. Keep DB-backed tests gated on an explicitly supplied test database.
4. Review deployment environment-variable handling, frontend API URL, Render health checks, CORS, HTTPS, and session cookies for the confirmed staging/pilot domains. Document exact provider settings without secret values.
5. Update deployment documentation and a concise release checklist with migrations, health checks, smoke tests, rollback considerations, and known product limitations.
6. Verify the final diff and rerun the checks. Report exact results and any remaining blockers; do not claim production readiness if contract gates or external-service decisions remain unresolved.

## Acceptance criteria
- Client lint, TypeScript checking, and production build pass in a clean install.
- Safe API tests pass; any DB integration run uses a confirmed disposable test database.
- CI runs the same safe checks without requiring production secrets.
- Deployment documentation matches the checked-in configuration and names every required environment variable without exposing values.
- CORS and authenticated browser requests are verified against the actual deployment domains and approved cookie strategy.
- No deployment, commit, paid resource, provider account, or production-data test occurs as part of this implementation.
