# Start the app at login

## Goal
Make opening the site root (`/`) show the login page instead of sending visitors directly to the student dashboard.

## Context
- `client/app/page.tsx` currently redirects every root visit to `/student/dashboard`.
- Login routing in `client/components/auth/LoginForm.tsx` already sends successful student and vendor logins to their role-specific dashboards.

## Implementation
Change only the root route behavior so `/` redirects to `/login`. Preserve existing role-specific login redirects, the vendor login route, and dashboard behavior. Do not add a new authentication system or change middleware as part of this focused fix.

## Verification
- Visiting `/` resolves to `/login` on a clean browser session.
- `/login` renders the student login form and its existing vendor-login navigation remains available.
- Successful student and vendor login redirects remain role-specific.
- Run the relevant client lint, type, and build checks.
