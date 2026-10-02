# Display the Signed-In Account Name

## Objective
Show the name returned for the authenticated account instead of the hardcoded `Jamie Smith` prototype identity.

## Scope
- After a successful login and role check, retain only the returned account identity needed by the UI, such as `user.fullName`, `user.email`, and role. Do not store the password.
- Use a small client-side identity mechanism that can be read by the shared dashboard UI without accessing browser storage during server rendering.
- Replace the placeholder identity in the shared sidebar and header, student dashboard greeting, and student profile with the signed-in account's name. Show the real account email on the profile instead of the sample email.
- Generate the sidebar initials from the displayed name.
- Clear the cached display identity when the user logs out.
- Keep the existing mock marketplace and order data unchanged. Treat cached identity as display-only, never as proof of authentication or authorization.
- Provide a neutral fallback if the login response omits a name; do not show another user's placeholder name.

## Acceptance Criteria
- Registering an account, then logging in with it, displays the account name returned by the API in the student dashboard greeting, shared header/sidebar, and student profile.
- Vendor dashboards display the same signed-in account name in shared chrome.
- Profile email reflects the logged-in account where shown.
- No password is stored in browser storage, and logout clears the cached identity.
- Existing pages render without hydration errors and the client lint/build checks pass.
