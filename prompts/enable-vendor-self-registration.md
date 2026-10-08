# Enable Vendor Self-Registration

## Objective
Allow vendors to create their own vendor login through the public registration flow, while preserving student registration and the dedicated vendor login page.

## Scope
- Restore account-type selection on the public registration form for Student and Vendor.
- For student registration, require student number; for vendor registration, require vendor name. Show only the fields relevant to the selected role.
- Restore vendor role and vendor name in the client registration payload types.
- Update `POST /api/auth/register` to accept valid vendor registrations again. Preserve the existing transaction behavior: link an existing vendor profile with no owner when the normalized vendor name matches; otherwise create a vendor profile owned by the new account. Reject attempts to claim an already-owned vendor profile.
- Keep the role-specific login flow: students use `/login`, vendors use `/vendor/login`; server-returned roles remain authoritative.
- Remove the current blanket vendor-registration rejection, while preserving input validation, password hashing, duplicate-email handling, and transaction rollback.

## Acceptance Criteria
- A visitor can select Vendor on `/register`, enter vendor name and account details, and create a vendor account.
- Student registration still requires student number and works as before.
- Vendor signup links an unclaimed matching vendor or creates a new vendor profile; it never takes over an already-owned vendor.
- A successfully registered vendor can log in at `/vendor/login` and reaches the vendor dashboard.
- Client lint/build and server auth registration tests pass, including tests for duplicate ownership and normal student registration.

## Constraints
- Do not expose or log passwords; continue hashing them server-side.
- Do not weaken vendor role authorization or allow cross-vendor data access.
- Keep existing Campus Eats design and avoid unrelated auth changes.
