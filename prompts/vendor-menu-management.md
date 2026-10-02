# Vendor Menu Management

## Objective
Allow an authenticated vendor to add, edit, search, and remove their own menu items, with changes persisted in PostgreSQL and reflected in student browsing/checkout.

## Current Findings
- `/vendor/menu` renders global `vendorMenuItems` mock data. Search, Add Item, Edit, and Delete controls do not perform actions.
- The API has a public `GET /api/menu` backed by PostgreSQL seed data, but no vendor-specific menu endpoint or mutation routes.
- Vendor accounts are associated with a vendor through `vendors.owner_user_id`; menu writes must use that session-owned vendor ID, never a client-submitted vendor ID.
- Orders snapshot menu item names and prices. Hard-deleting a menu item referenced by an order would break referential integrity and historical order details.

## Scope
- Add a role-protected `GET /api/vendor/menu` that returns only the authenticated vendor's menu items, including unavailable items.
- Add server-validated create/update/delete-or-retire operations for menu items. Use the vendor from the authenticated session, not a request vendor ID. Validate item name, category, description, integer price in cents/range, and availability.
- Let vendors add items and edit item name, category, description, price, and availability in the menu UI. Implement search and loading, empty, save-success, and error states. Retain the existing Campus Eats styling and controls.
- For remove: delete an item only if no order references it; otherwise mark it unavailable/retired while retaining its record so historical orders and price snapshots remain valid. Explain the result clearly in the UI.
- Keep checkout prices and availability server-authoritative. Student browsing must not display unavailable items, and server checkout must continue rejecting unavailable items after a vendor edit.
- Refresh or revalidate student catalog data after successful vendor changes; do not trust or patch only client-side mock data.
- Do not add menu-image upload, broad profile edits, or unrelated vendor dashboard features.

## Acceptance Criteria
- A vendor sees only menu items owned by their vendor profile; a vendor cannot read, edit, add to, or remove another vendor's menu through altered request parameters.
- A vendor can add an item and see it persist after refresh; students can see the available item in browsing/checkout with the server-approved price.
- Editing an item persists its name/category/description/price/availability and student checkout immediately uses the updated server price and availability.
- Unavailable items are hidden from public menu reads and cannot be ordered.
- Removing an unreferenced item deletes it; removing an item used by an order safely retires it and preserves existing order history.
- Invalid values and API/storage errors produce readable feedback; menu loading, empty, and successful save states are handled.
- Focused API tests cover vendor ownership, validation, availability, edit persistence, and referenced-item retirement; client lint/build pass and the vendor workflow is verified in the browser.
