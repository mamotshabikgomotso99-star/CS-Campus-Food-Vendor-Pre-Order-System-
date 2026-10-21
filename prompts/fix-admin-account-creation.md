# Fix Admin Account Creation

## Objective
Repair the local admin bootstrap command so an administrator can be created and then sign in successfully.

## Execution constraints
- Follow repository `AGENTS.md` and `PROJECT_CONTRACT.md`; keep the change limited to admin provisioning.
- Do not request, print, copy, or commit admin credentials or database connection values.
- Do not create an admin account or write to the configured database as part of this code fix. The user will run the bootstrap command with their private `server/.env` values.
- Preserve the current admin role, password hashing, database migrations, and public login flow.

## Verified findings
- A read-only aggregate query against the database configured in local `server/.env` found no users with role `admin`.
- `node --check server/scripts/create-admin.js` fails with `SyntaxError: Unexpected token ')'` at line 37.
- The admin login page therefore cannot authenticate against the local database until an admin record is created.
- A screenshot exposed a password; treat that value as compromised and do not reuse it.

## Scope
- Fix the syntax error in `server/scripts/create-admin.js` without changing the account-creation behavior or credentials handling.
- Check the script syntax and run appropriate safe server checks.
- Do not run `npm --prefix server run create-admin`; it writes a user to the configured database.
- Report the exact command and required private environment variable names for the user to create the account after the fix.

## Acceptance criteria
- `node --check server/scripts/create-admin.js` succeeds.
- Safe server tests pass, or any unrelated failures are reported clearly.
- The admin bootstrap command remains gated by `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, and `DATABASE_URL` from private `server/.env`.
- No database records are changed and no secrets are exposed by this work.
