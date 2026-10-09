# Keep signup role in sync with URL

## Goal
Fix the signup page showing Student at `/register?role=vendor` after navigating from the student signup page, or vice versa.

## Root cause
`client/app/register/page.tsx` derives `initialRole` from `searchParams`, but `RegisterForm` is a client component that initializes its role state with `useState(initialRole)`. Next.js can reuse the mounted component when only the query string changes, so its state does not reset to the new role.

## Implementation
Make the signup form instance update when `initialRole` changes, using a narrowly scoped remount key at the route boundary or an equivalent role-sync approach. Preserve vendor/student-specific labels, fields, submission payloads, and existing role-specific post-login routes. Do not change unrelated signup behavior.

## Verification
- Open `/register`, use the Vendor switch, and confirm URL and form both show Vendor, vendor intro, Vendor name field, and vendor login link.
- Use the Student switch and confirm URL and form both show Student, student intro, Student number field, and student login link.
- Repeat switching without a full browser reload; direct loads of either URL must also show the correct role.
- Run the relevant client lint, type, and build checks.
