# Add card payment option to the student checkout flow

## Goal
Add a payment section to the existing student checkout so a customer can enter card details and complete a purchase before the order is submitted. Keep the implementation aligned with the current Campus Eats prototype: the checkout UI should feel realistic, but it should not integrate with a real payment provider or expose secrets.

## Relevant files
- client/components/orders/StudentCheckout.tsx
- client/lib/api.ts
- client/app/student/orders/new/page.tsx
- any related order summary or API contract usage

## Requirements
1. Extend the checkout form in StudentCheckout so it displays a payment section before the final submit action.
2. Add card fields for:
   - cardholder name
   - card number
   - expiry date
   - CVV
   - billing postcode / ZIP (optional but helpful)
3. Validate the card form client-side before order submission.
4. Add clear loading, success, and error states for payment submission.
5. Keep the user experience consistent with the existing lavender Campus Eats visual design.
6. Preserve the server-authoritative order and totals flow; do not trust client-submitted prices or state.
7. Do not store or log raw card values in the browser or backend logs.
8. Do not integrate with a real payment processor unless this is explicitly approved as an external service decision.
9. If a real payment provider is not available, simulate the payment step as a secure front-end-only checkout experience with a clear confirmation message after a successful validation.

## UX expectations
- The customer should see a clear "Payment" card block in the checkout sidebar or form area.
- The order summary and total should remain visible while they enter card details.
- If card details are invalid, show inline field errors and stop the submit action.
- On successful checkout, keep the order placement flow working and show the confirmation state already used in the component.
- If the user changes the selected vendor or cart contents, reset payment form state appropriately.

## Technical constraints
- Keep functions small and typed.
- Prefer a minimal frontend-only change, not a broad refactor.
- No unrelated refactors, no visual drift away from the existing design language.
- If the API contract currently does not support payment capture, model the payment field as a front-end validation layer and keep backend placement unchanged.
- Keep any new UI logic inside the existing checkout component unless there is a strong reason to add a separate file.

## Acceptance criteria
- A customer can complete the checkout by entering card details in the UI.
- The form blocks invalid submissions and shows helpful validation errors.
- The order can still be placed through the existing Create Order flow.
- The payment section is styled consistently and feels like part of the checkout experience.
- No payment secrets or real provider credentials are introduced.
- Existing checks still pass with no regressions.

## Verification
Run the relevant project checks after implementation, then share the exact steps to test the payment flow in the browser.
