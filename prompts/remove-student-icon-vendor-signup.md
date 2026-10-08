# Make vendor signup distinct

## Goal
Make vendor signup visibly distinct from student signup under the form header by using vendor-specific title and introductory copy.

## Context
- Vendor signup is `/register?role=vendor` and `client/app/register/page.tsx` derives `initialRole` from the query parameter.
- The registration form passes its active role to `RoleSelector`.
- `showVendor` is false on the register route, so the selector should display only the active role.
- `client/components/auth/RegisterForm.tsx` currently uses the same "Create your account" title and "Join the campus food ordering community." description for both roles.

## Implementation
When the active role is vendor, show the title "Create your vendor account" and a vendor-focused description such as "Set up your vendor account to manage your menu and incoming orders." Keep the existing student title and description unchanged. Retain the Vendor role card, vendor-specific fields, and registration payload. The large auth brand mark stays hidden on vendor signup.

## Verification
- `/register?role=vendor` shows vendor-specific title and intro copy, the Vendor card, and the Vendor name field.
- `/register` still shows the existing student title and intro copy, Student card, and student number field.
- Vendor registration still submits with the vendor role.
- Run the relevant client lint/type checks available in the repository.
