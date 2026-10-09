# Use one shared login page

## Goal
Provide one neutral login page for students and vendors. The login page must not label the user as a student or vendor before authentication and must not offer a role-switching login link.

## Context
- `/login` currently renders `LoginForm` with its default student role.
- `/vendor/login` renders the same form with `role="vendor"`, changing copy and rejecting the other role.
- `LoginForm` currently links to a separate vendor login route.
- The API's `POST /api/auth/login` response includes the authenticated account's `role` and user identity.

## Implementation
- Make the shared login form role-neutral: use one heading and generic sign-in copy for both roles.
- Authenticate by email and password without checking against a route-selected role.
- After successful authentication, trust the validated role returned by the API, save that role in the auth identity, and redirect vendors to `/vendor/dashboard` and students to `/student/dashboard`.
- Remove the vendor/student login switch from the login UI.
- Ensure `/vendor/login` resolves to the same shared `/login` page (redirect or equivalent) so existing links remain compatible without creating a second login experience.
- Preserve registration links, forgot-password link, session behavior, error handling, and role-specific dashboard destinations.

## Verification
- `/login` shows neutral sign-in copy and no student/vendor login switch.
- `/vendor/login` lands on the same neutral login page.
- A successful student login routes to `/student/dashboard`.
- A successful vendor login routes to `/vendor/dashboard`.
- Incorrect credentials and API errors remain visible and do not create an auth identity.
- Run relevant client lint/type checks and server auth tests.
