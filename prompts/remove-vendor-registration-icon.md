# Remove Vendor Registration Icon

## Objective
Remove the prominent Store icon from the Vendor account-type option on the Create Account page.

## Scope
- Update `client/components/auth/RoleSelector.tsx` so the Vendor option no longer renders the Store glyph or its icon container.
- Keep the Student icon, account-type choices, selection states, descriptions, and registration behavior unchanged.
- Preserve clean spacing and alignment after removing the Vendor icon.
- Do not alter other Vendor icons elsewhere in the product.

## Acceptance Criteria
- The Create Account page shows no Store icon in the Vendor option.
- The Student icon and both role choices remain visible and work as before.
- Client lint/build pass and the registration form is checked in the browser.
