# Hide Vendor Login and Disable Vendor Sign-Up

## Objective
Make vendor access unobtrusive while preventing public creation of vendor accounts.

## Proposed Behavior
- Keep `/login` as the student login page and remove the account-role selector from its public UI.
- Add a direct `/vendor/login` page for existing vendor/staff accounts.
- Add a small, low-emphasis `Vendor login` link at the bottom-right of the public student login card, pointing to `/vendor/login`. Keep it visually secondary to student sign-in and sign-up.
- Ensure the vendor login accepts only accounts whose server-returned role is `vendor`; successful vendor logins continue to `/vendor/dashboard`.
- Make public `/register` create student accounts only. Remove role selection and vendor-name registration fields from that form.
- Reject vendor-role registration in the Express registration endpoint with a clear vendor-specific message, even when called directly, while preserving student registration and existing vendor account login.
- Do not add an admin account-provisioning feature or change vendor authorization/data access beyond what is necessary for this flow.

## Relevant Areas
- `client/components/auth/LoginForm.tsx`
- `client/components/auth/RegisterForm.tsx`
- `client/app/vendor/login/page.tsx` (new route)
- `server/app.js` registration validation
- Relevant API payload/role types and server tests if needed

## Acceptance Criteria
- Public login presents student login only, with no visible vendor/staff option.
- Existing vendor accounts can sign in through `/vendor/login` and are sent to the vendor dashboard; student accounts cannot use that route to enter the vendor portal.
- Public login keeps student login and sign-up prominent, with only a subtle vendor-login link at the bottom-right.
- Public registration only offers student accounts.
- Direct API attempts to register with role `vendor` are rejected, while valid student registrations continue to work.
- User-facing login and registration copy refers to vendors, not staff.
- Existing vendor accounts remain able to log in.
- Client lint/build and relevant server tests pass; verify public login, registration, staff login, and role rejection behavior.

## Constraints
- Preserve existing auth/session security and Campus Eats visual conventions.
- Do not present vendor login as an account-type choice or prominent call to action.
- Do not alter order, menu, or other product behavior.
