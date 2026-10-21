# Repair Auth Registration Test File

## Objective
Repair the malformed and duplicated code in `server/test/auth-registration.test.js` so the isolated authentication, registration, vendor-application, and admin-approval tests can run again.

## Execution constraints
- Follow repository `AGENTS.md` and `PROJECT_CONTRACT.md`; do not change application behavior or unrelated test files.
- Preserve the intended test cases and use the existing mock-pool and `startRegistrationServer` conventions.
- Do not run PostgreSQL-backed tests against the database configured in `server/.env` unless the user confirms that database is disposable.
- Do not create or modify accounts in any database.

## Verified findings
- `node --check server/test/auth-registration.test.js` fails at line 326 with `SyntaxError: Unexpected token '}'`.
- The file contains an unclosed `createRegistrationPool` helper, an empty duplicate `createLoginPool`, and a duplicate `createAdminPool` definition.
- The non-database vendor-application test contains an incomplete setup and repeated body fragment; the file also has a stray closing fragment at the end.
- Several tests explicitly skip only when `DATABASE_URL` is absent, and the test file loads `server/.env`, so a normal full-file run may execute PostgreSQL integration tests.
- `server/scripts/create-admin.js` is already fixed and passes `node --check`; keep this task scoped to the test file.

## Scope
- Remove only malformed/duplicate fragments and restore the missing test setup using the file's existing mock fixtures.
- Keep PostgreSQL-backed tests unchanged.
- Validate syntax with `node --check`.
- Run only non-database auth-registration tests using `--test-name-pattern` or another demonstrably safe approach; do not run the PostgreSQL cases against the configured database.
- Report any unrelated test failures separately.

## Acceptance criteria
- `node --check server/test/auth-registration.test.js` succeeds.
- The isolated non-database tests in this file pass.
- No database records, account credentials, or application code are changed.
- The final report lists any checks intentionally not run because they require a disposable database.
