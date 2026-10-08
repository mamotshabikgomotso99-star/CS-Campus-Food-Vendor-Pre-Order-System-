# Create Vendor Logins

## Objective
Provision login accounts for existing vendor profiles without enabling public vendor self-registration.

## Scope
- Add a local-only server CLI that provisions an account for an existing vendor profile and links it through `vendors.owner_user_id`.
- Let the operator choose one of the existing unlinked vendors and enter the account holder's name and email locally.
- Prompt for the initial password without echoing it; store only a hash using the same password-hashing scheme as the login API.
- Use a database transaction. Reject duplicate emails and vendors that already have an owner. Never log passwords or database credentials.
- Keep the existing public registration rejection for vendor accounts. Do not add a public provisioning endpoint or change login/session authorization.

## Acceptance Criteria
- The four currently unlinked seeded vendors can each be assigned an existing operator's name/email and a private initial password.
- The new account is stored with role `vendor` and linked to the selected vendor profile.
- Provisioning does not overwrite an existing owner, and a failed operation rolls back completely.
- Password input is hidden and only the password hash is persisted.
- The operator can sign in at `/vendor/login`; the resulting account is authorized only for its linked vendor.
- Add focused verification for successful and rejected provisioning cases; run the relevant server test and client build checks.

## Constraints
- Use the configured server database only; do not invent account emails or passwords.
- Do not send credentials through browser UI, logs, chat, or source control.
