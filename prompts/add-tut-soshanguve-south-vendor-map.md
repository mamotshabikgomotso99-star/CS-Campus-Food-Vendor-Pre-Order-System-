# Add TUT Soshanguve South Vendor Map

## Objective
Give students an interactive map to find and navigate to Campus Eats vendors at Tshwane University of Technology (TUT), Soshanguve South. Let administrators place and update each vendor's map pin. Never invent or infer exact vendor coordinates from the existing free-text collection point.

## Current behavior
- `client/app/student/vendors/page.tsx` builds vendor cards from menu items; it has no map or location display.
- `GET /api/menu` returns menu and vendor names but not collection locations or coordinates.
- Vendor records store `collection_location` as text only; there are no latitude/longitude fields.
- The admin dashboard currently reviews vendor applications and has no approved-vendor location management.
- The repository requires a prompt and explicit approval before application implementation.

## Required implementation
1. Add a forward-only PostgreSQL migration for nullable vendor latitude and longitude fields, with validation that coordinates are either both null or both present and within valid geographic ranges. Register the migration in `server/database.js`. Do not assign placeholder coordinates to existing vendors.
2. Add admin-only API routes to list approved vendors and update a vendor's coordinates. Validate finite latitude/longitude, use parameterized queries, enforce the admin role, and return the vendor name, collection-point text, and saved coordinates. Keep account and vendor authorization server-side.
3. Extend the admin dashboard with a vendor-locations management view. Show approved vendors, existing collection-point text, saved coordinates, and whether a pin is set. Provide latitude/longitude fields for an admin to save coordinates they have confirmed at the collection point. Do not put an interactive map in the admin area. Include loading, empty, success, and error states. Do not change the vendor application approval flow.
4. Extend student dashboard and vendor discovery data to include each vendor's collection-point text and coordinates. Show the interactive student map on `/student/dashboard`, and add a map/list view control on the vendor discovery page; list search must filter the map markers as well. Display only vendors with saved coordinates on the map and clearly label vendors whose location has not been pinned rather than placing them approximately.
5. Use a maintained Leaflet-based React map library with client-only loading for Next.js. Use OpenStreetMap-compatible tiles for the prototype, retain required map/tile attribution, and document the tile source and any production usage limits. Establish the TUT Soshanguve South map center and bounds from a verifiable public map reference; do not fabricate the campus extent or vendor pin data.
6. Selecting a marker should show the vendor name, collection-point text, and an action to open walking directions in an external map service. Use the saved coordinates as the destination. Do not request browser geolocation unless the student explicitly chooses a current-location action; keep the map usable without location permission.
7. Keep map controls responsive and accessible. Provide keyboard-accessible vendor selection, map/list state, marker descriptions, visible focus states, and an explicit attribution link. Ensure the map has stable responsive dimensions and loading/error states.
8. Add focused server tests for admin authorization, coordinate validation, saving and returning locations, and public discovery data. Add or update client checks for map/list filtering and location-missing states where the existing test setup permits. Do not require real map credentials or network access in unit tests.

## Constraints
- Scope the map to TUT Soshanguve South; do not add multi-campus support.
- Never populate a vendor pin from a guess, vendor name, or free-text location alone.
- Do not use a paid map or routing API, add provider credentials, or expose secrets to the browser.
- Preserve existing vendor approval, menu, and order behavior.
- Use a new numbered migration; never edit an already-applied migration.
- Keep the student map based on server-owned vendor location data, not hard-coded client records.

## Verification
- Run focused API tests and the full server test suite.
- Run client typecheck, lint, and production build.
- Verify an admin can save a pin and a student sees that pin and the vendor's collection text; verify an unpinned vendor is not shown at a fabricated location.
- Verify a non-admin cannot read or change admin location data.
- Test the student dashboard map at desktop and mobile widths, including map/list switching in vendor discovery, filtering, marker details, directions link, loading, empty, and error states. Confirm no interactive map renders in the admin area.
- Provide exact manual test steps and document any external tile-service dependency.