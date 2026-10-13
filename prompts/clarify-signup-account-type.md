# Clarify Signup Account Type

## Goal
Make it clear on the registration form how student and vendor account types are determined.

## Implementation
Update `client/components/auth/RegisterForm.tsx` to show concise helper text near the optional student and staff number fields: entering either number creates a student account; leaving both blank creates a vendor account. Keep existing fields, registration payload, server role inference, validation, layout conventions, and all other signup behavior unchanged.

## Verification
- Confirm the copy accurately describes the current server behavior.
- Run the client build and inspect the registration form for clear placement and responsive layout.
