# Vendor Profile Picture Upload

## Objective
Allow a signed-in vendor to add and manage a vendor profile picture from `/vendor/profile`.

## Scope
- Replace the static store avatar on the vendor profile with a circular image preview when the vendor has selected a photo; preserve the existing store icon fallback when no photo is saved.
- Provide accessible `Add photo`/`Change photo` and `Remove photo` controls with immediate preview.
- Accept JPEG, PNG, and WebP images up to 2 MB. Validate format and file size before saving. An invalid selection must show a readable inline error and retain the previously saved picture.
- Persist the image in browser-local storage under a vendor-specific key derived from the authenticated vendor account email, distinct from the student photo key. Do not put image data in auth identity/session state or treat it as authorization data.
- Restore the saved picture after refresh; remove it and restore the fallback when `Remove photo` is selected. Handle invalid stored values and browser storage errors visibly.
- Keep the existing vendor profile layout and Campus Eats styling. Do not modify the student profile uploader, add an API/database/image service, or imply the photo was uploaded to the server. State clearly that the photo is saved only in this browser.
- Provide meaningful alt text, keyboard-accessible controls, and no leaked object URLs.

## Acceptance Criteria
- A vendor can add, replace, and remove a supported image from `/vendor/profile`.
- The image is visible immediately and remains after refresh in that browser.
- Different vendor account emails use separate saved photos, and student profile photos remain unaffected.
- Unsupported files and files larger than 2 MB display inline errors without overwriting an existing saved image.
- The existing store-icon fallback displays when no image is saved or browser storage is unavailable.
- Client lint/build pass and add/replace/remove/persistence behavior is verified in the browser.
