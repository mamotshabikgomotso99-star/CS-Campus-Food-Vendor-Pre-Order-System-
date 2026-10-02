# Activate Logout Control

## Objective
Make the shared dashboard Logout control functional for student and vendor pages.

## Scope
- Update `client/components/dashboard/Sidebar.tsx`.
- Add a client-side click handler to the existing logout button.
- Clear any prototype auth/session markers if they exist, without introducing a backend logout API.
- Navigate the user to `/login` after logout.
- Preserve the existing visual design and public component API.

## Acceptance Criteria
- Clicking Logout from `/student/*` navigates to `/login`.
- Clicking Logout from `/vendor/*` navigates to `/login`.
- The control remains keyboard accessible and keeps its existing accessible text.
- Client lint/type checks pass.
