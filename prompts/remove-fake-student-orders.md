# Remove Fake Student Order Data

## Objective
Ensure a new student account shows no completed, active, pending, recent, or tracked orders until a real order has been placed.

## Scope
- Remove the hardcoded student order counts (`Active Orders`, `Completed Orders`, and `Pending Orders`) from the student dashboard and derive them only from real order records; with no records, display zero.
- Remove global sample `studentOrders` from the student dashboard and `/student/orders` view so one account never sees another account's sample history.
- Show a clear empty state on the orders page with a link to browse vendors when the current student has no real orders.
- Do not remove available-vendor information or unrelated vendor/menu sample data.
- Do not invent order records or treat checkout as successful when the current placeholder checkout does not create an order. Only display an order after the actual order-creation flow reports success.
- Keep the change limited to correcting the student-facing mock order display. Do not add a new database, authentication/session system, or vendor status workflow as part of this focused correction.

## Acceptance Criteria
- With a new account and no real order records, active, completed, and pending counts are zero; recent orders and order history show no sample records.
- The student orders page presents a useful empty state and a browse-vendors action.
- Existing real order records, when supplied by an order source, are the only records displayed and counted.
- No changes are made to vendor pages or unrelated marketplace content.
- Client lint and production build checks pass, and the empty state is verified in the browser.
