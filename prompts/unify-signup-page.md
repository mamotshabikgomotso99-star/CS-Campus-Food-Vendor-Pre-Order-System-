# Remove role selection from public signup

## Goal
Public signup should not ask whether someone is a student or vendor/employer. The system should assign public signups to the student role, without requiring a student number; vendor accounts are created through secure staff provisioning.

## Product decision
Public self-registration creates student accounts only. Vendor accounts are provisioned by authorized staff using the existing secure vendor provisioning workflow. Do not infer a role from unverified user input, email text, or query parameters.

## Implementation
- Use `/register` as the public student signup route with neutral "Create your account" copy and no account-type selector or vendor/student switch link.
- Collect student details and submit `role: "student"` from the client. Student number is optional in both the UI and API.
- When student number is omitted or blank, store SQL `NULL` rather than an empty string so multiple accounts without student numbers do not conflict with the unique constraint.
- Enforce the public-registration policy in `POST /api/auth/register`: reject vendor-role submissions even if a caller crafts the request manually. Preserve validation for name, email, password, and confirmation, as well as transaction behavior and duplicate-account errors.
- Keep vendor login accounts and role/profile linkage available through the existing secure staff provisioning workflow; do not expose staff provisioning in the public signup UI.
- Make `/register?role=vendor` resolve to the same public student signup route rather than enabling vendor self-registration.
- Preserve the unified login page, which authenticates with email/password and routes both students and vendors according to the API-returned role. Student number must not be part of login validation.

## Verification
- `/register` shows neutral signup copy, an optional student-number field, and no role selector or vendor switch link.
- Student registration succeeds with or without a student number; omitted values are stored as `NULL`.
- A direct API request attempting public vendor registration is rejected; student registration still succeeds.
- `/register?role=vendor` cannot create or select a vendor account.
- Existing provisioned vendor accounts can still log in with email/password through the unified login page and reach the vendor dashboard, without requiring a student number.
- Run relevant client lint/type checks and server registration/provisioning tests against a development/test database only.
