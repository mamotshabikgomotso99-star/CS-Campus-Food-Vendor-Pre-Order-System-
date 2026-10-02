# Expand the Vendor Menu

## Objective
Let a vendor add and edit their own menu items, including a picture selected from their computer, in the current browser prototype.

## Scope
- Update `client/app/vendor/menu/page.tsx` so Add Item opens an accessible form with name, category, description, price, availability, and optional image fields.
- Provide an image file picker for PNG, JPEG, or WebP images, validate the file type and a reasonable size limit, and show a preview before saving.
- Allow editing existing items, including replacing or removing their image. Keep delete behavior only if it can be implemented with the same local data model without broadening scope.
- Save menu changes in browser-local storage suitable for image data (IndexedDB), so refreshes in this browser preserve the menu. Do not store image files as large data URLs in localStorage.
- Keep the existing seeded menu visible, and show loading, empty, validation, and save/error states. Clearly indicate in the UI that this prototype's added items are only stored in this browser and are not synced to other devices or a backend.
- Do not change authentication, orders, pricing elsewhere, or unrelated mock records. Do not claim browser storage is authoritative or production persistence.

## Acceptance Criteria
- Add Item opens a usable form; a vendor can enter required details, select a local image, preview it, and save the item.
- A saved item and its image remain visible after refreshing the page in the same browser.
- Invalid image formats or oversized files are rejected with a clear message.
- Existing items remain intact; editing updates the selected item and a selected replacement image displays.
- The menu remains usable on desktop and mobile, with keyboard-accessible controls.
- Client lint and production build pass.
