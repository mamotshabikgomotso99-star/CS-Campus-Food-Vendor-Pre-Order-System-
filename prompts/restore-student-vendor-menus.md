# Restore Student Vendor Menus

## Objective
Restore menu listings on student vendor pages when the API is unavailable in prototype mode.

## Scope
- Fix the fallback in `client/lib/api.ts` so requests to `/api/menu` with or without a `vendorId` query return menu data instead of an error.
- Reuse the existing `vendorMenuById` mock records from `client/lib/dashboard-data.ts` as fallback menu content, mapping their fields into the `MenuApiItem` response shape.
- Filter fallback records by the requested vendor ID; an unknown vendor should return an empty menu rather than another vendor's items.
- Keep successful live API responses authoritative. Do not use mock fallback data for vendor management endpoints or non-menu errors.
- Keep this limited to prototype menu availability; do not change the backend, checkout/payment behavior, or menu design.

## Acceptance Criteria
- With the API unavailable, each known student vendor page displays its existing menu items and item prices instead of a fetch error or empty menu.
- A filtered menu response contains only the requested vendor's items; an unknown vendor returns an empty list.
- The unfiltered menu fallback contains menu items from all known vendors.
- When the API is available, its response is used as before.
- Client lint and production build pass, and the Fresh Bites vendor menu is verified in the browser.
