# Remove Checkout Billing Postcode

## Objective
Remove the billing-postcode field from the student checkout payment form.

## Scope
- Remove the visible Billing postcode input and its inline error display from `client/components/orders/StudentCheckout.tsx`.
- Remove `postalCode` from the payment form state, initial state, and validation types/rules so the remaining payment validation does not require a postcode.
- Preserve cardholder name, card number, expiry, and CVV inputs and validation, as well as existing order placement behavior and styling.
- Do not change API contracts, payment integrations, backend behavior, or unrelated checkout UI.

## Acceptance Criteria
- The checkout payment form no longer displays a Billing postcode field.
- A customer can submit valid remaining card details without entering a postcode.
- Invalid cardholder name, card number, expiry, or CVV still shows the existing inline validation errors.
- Client lint and production build pass, and the checkout page is visually checked.
