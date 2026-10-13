# Admin Vendor Approval Flow

Implement a controlled vendor onboarding flow for Campus Eats so vendor accounts are not created like a normal student/staff signup and must be approved by an admin before they can log in.

## Goal
Add a dedicated admin sign-in path and route protection so that:
- Students and staff can still create accounts quickly.
- Vendor account requests are submitted through a restricted process and held for admin review.
- An admin can approve or reject the vendor request.
- Only approved vendors may access vendor dashboard functionality.
- The current app stays consistent with the existing lavender Campus Eats styling and prototype architecture.

## Current codebase context
- The app is a Next.js frontend with protected student/vendor dashboards and a simple Express backend.
- The prototype currently treats vendor signup as a normal registration flow and exposes it directly from the generic account registration page.
- Session/auth state is handled in the client using `client/lib/auth-session.ts` and the API layer in `client/lib/api.ts`.
- The basic login form currently accepts only `student` and `vendor` account roles, and the app assumes vendor access is direct after login.
- The backend is still mostly prototype/auth scaffolded and the product notes in `AGENTS.md` explicitly say vendor onboarding should be admin-reviewed and vendor accounts should not be created casually.

## Required implementation
1. Add an admin role to the frontend auth model and login flow.
   - Introduce `admin` as a valid account role in the auth/session types.
   - Add an admin login route or admin section that is clearly separate from student login.
   - Ensure admin login goes to an admin dashboard and not the vendor or student portal.

2. Restrict vendor creation.
   - Remove the easy, direct vendor-account creation path from the normal sign-up flow.
   - Keep student/staff registration simple and fast.
   - Vendor sign-up should be a separate submit-request flow that creates a vendor request entry rather than an active vendor account.
   - Mark the vendor request as pending until an admin approves it.

3. Create an admin approval workflow.
   - Add an admin-only dashboard/table that lists pending vendor requests.
   - Admin should be able to review each request and approve or reject it.
   - When approved, the request becomes an active vendor account and the vendor can sign in.
   - When rejected, the request stays denied and is not allowed to sign in.
   - Include clear empty/loading/error/success states for approval actions.

4. Protect vendor access.
   - An unapproved vendor should not be able to sign in to vendor pages.
   - Approved vendors can access their menu/order dashboard only after the admin status is active.
   - The frontend guard should reject unauthorized vendor logins and redirect clearly.

5. Keep the route experience clean.
   - Preserve the existing Campus Eats layout and theme.
   - Do not break the normal student login flow.
   - Add admin-only navigation or a landing section for reviewing vendor requests.

6. Maintain prototype-safe behavior.
   - Since this repo is still a prototype, implement the approval flow in the existing client/server mock patterns without introducing a large redesign.
   - The app should be developer-friendly and easy to demonstrate locally.
   - If API endpoints are missing, use the existing fetch pattern and local mock/state handling as a compact prototype while preserving the desired behavior.

## Files likely to be touched
- `client/lib/api.ts`
- `client/lib/auth-session.ts`
- `client/lib/validations.ts`
- `client/components/auth/LoginForm.tsx`
- `client/components/auth/RegisterForm.tsx`
- `client/app/login/page.tsx`
- `client/app/register/page.tsx`
- `client/components/auth/RequireAuth.tsx`
- possibly new admin UI pages/components under `client/app/admin/` and `client/components/admin/`

## Acceptance criteria
- Student/staff sign up remains straightforward.
- Vendor accounts are not instantly active from the generic sign-up form.
- Admin can sign in with a dedicated admin account.
- Admin can approve or reject vendor requests.
- Only approved vendors can log in and access vendor pages.
- Unauthenticated users and unauthorized roles are redirected to the correct page.
- The app still builds and runs with the existing local Next.js prototypes.

## Verification
- Run the relevant frontend checks after implementation.
- Confirm the login flow works for student, admin, and approved vendor paths.
- Confirm rejected or unapproved vendor requests are blocked.
- Provide a concise description of the exact test steps used.
