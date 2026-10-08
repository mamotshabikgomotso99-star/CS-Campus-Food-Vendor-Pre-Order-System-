# Show the vendor role on vendor signup

## Goal
Show a Vendor role card with the vendor-specific description on vendor signup, rather than showing the Student role card or omitting the role entirely.

## Context
- Vendor signup is `/register?role=vendor` and `client/app/register/page.tsx` derives `initialRole` from the query parameter.
- The registration form passes its active role to `RoleSelector`.
- `showVendor` is false on the register route, so the selector should display only the active role.

## Implementation
Render the role selector for both registration roles, showing only the active role when `showVendor` is false. Use the Vendor label and "Manage menus and incoming orders" description with a vendor-appropriate storefront icon. Preserve the vendor role, fields, and registration payload. Keep the Student card on student signup. The large auth brand mark stays hidden on vendor signup.

## Verification
- `/register?role=vendor` shows the Vendor card and vendor description, no Student role card or student-specific description, and the Vendor name field.
- `/register` still shows the Student role card and description.
- Vendor registration still submits with the vendor role.
- Run the relevant client lint/type checks available in the repository.
