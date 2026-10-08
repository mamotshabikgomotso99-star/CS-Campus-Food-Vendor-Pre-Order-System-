# Minimize Vendor Create-Account Entry

## Objective
Keep vendor self-registration available but make its entry point secondary on the vendor login page.

## Scope
- Add a small, low-emphasis `Create vendor account` link aligned at the bottom-right of the vendor login card only.
- Link to registration with the Vendor role preselected, using a query parameter such as `/register?role=vendor` and the repository's supported Next.js App Router search-param pattern.
- Preserve the student login page and its existing student sign-up link unchanged.
- Keep vendor sign-up fields, server registration behavior, password handling, and validation unchanged.

## Acceptance Criteria
- The vendor login page remains focused on email/password sign-in.
- A discreet `Create vendor account` link appears at the card's bottom-right.
- Clicking it opens registration with Vendor selected and the vendor-name field visible.
- Student login and student registration defaults remain unchanged.
- Client lint/build pass and verify both pages in the browser.
