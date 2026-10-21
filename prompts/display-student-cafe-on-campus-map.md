# Display Student Café on the Campus Map

## Objective
Make the existing `Student Café` vendor (`student-cafe`) assignable to a real, campus-confirmed map position and display it on the student campus map after an admin saves that position.

## Current behavior
- `client/components/map/CampusVendorMap.tsx` and `LeafletCampusMap.tsx` render vendor pins only when saved latitude and longitude exist.
- The map supports editable pin placement through map clicks and dragging, but the admin location manager currently uses coordinate inputs rather than the map.
- The `student-cafe` record is seeded in `server/database.js`. The admin vendor-location API currently lists only approved vendors with an owner and collection location, so this seeded record may not be assignable through the existing manager.
- No verified coordinates for the cafeteria are supplied. Do not guess or prefill a location.

## Required implementation
1. Extend the admin location workflow to include the existing `student-cafe` record without changing its vendor approval state or the behavior of other vendors. Keep the change explicit and limited to this seeded vendor identity.
2. Let an admin choose the cafeteria’s position by clicking the existing campus map or dragging its draft marker. Keep campus boundary validation on the server. Do not silently save a click; require an explicit save action and show pending, success, and error states.
3. Display the cafeteria as “Student Café” on the existing student map only after valid coordinates have been saved. Use the existing vendor/menu API and stored vendor coordinates as the source of truth; do not add hard-coded browser map coordinates.
4. Preserve the current vendor marker popup, map bounds, attribution, and walking-directions behavior. Make the new admin placement control usable by keyboard where practical and responsive on mobile.
5. Do not change menu availability, vendor approval, orders, or other seeded vendors. Do not introduce a separate cafeteria entity or map service.

## Constraints
- Exact placement must be confirmed by an administrator using the map; never infer coordinates from the campus center, cafeteria name, or collection-location text.
- Continue enforcing the existing campus polygon/bounds server-side and admin authorization for location management.
- Preserve all existing student map and vendor-location behavior outside the `student-cafe` inclusion and map-based placement.

## Verification
- Add/update focused tests proving the seeded Student Café can be listed and pinned by an admin, invalid/out-of-campus coordinates are rejected, and non-admin requests are denied.
- Verify the public menu/map data returns saved cafeteria coordinates and that the student map hides the cafeteria before pinning and displays it after pinning.
- Run focused server tests, the full server suite, and client typecheck/lint/build.
- Manually test admin map placement and saving, then inspect the student map at desktop and mobile widths. Confirm no coordinates were prepopulated or fabricated.
