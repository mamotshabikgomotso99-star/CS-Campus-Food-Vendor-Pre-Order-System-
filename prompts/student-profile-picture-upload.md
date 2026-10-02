# Student Profile Picture Upload

## Objective
Allow a signed-in student to upload and manage a profile picture from `/student/profile`.

## Scope
- Replace the profile's static avatar placeholder with a circular picture preview when a student has uploaded an image; retain the initials/icon fallback when no image is saved.
- Add an accessible file picker and clear `Change photo` and `Remove photo` actions.
- Accept JPEG, PNG, and WebP images up to 2 MB. Validate file type and size before saving, and show a readable inline error for unsupported or oversized files without discarding the current picture.
- Preview a valid selection immediately and persist it in browser-local storage so it remains after refresh. Key the saved picture to the current student's email so separate prototype accounts do not share an avatar. Do not store the image in the auth identity or treat it as authentication data.
- On removal, clear that student's saved picture and restore the existing fallback avatar.
- Keep the existing profile identity display, shared dashboard layout, and Campus Eats lavender/purple styling. Do not modify the vendor profile or add an API, database, external image service, or unrelated profile fields.
- Make the file control keyboard accessible, provide descriptive alt text, and avoid leaking object URLs if used for previews.
- Account for storage failures with a visible error state; do not claim the image uploaded to a server. Explain briefly in the UI that the photo is saved only in this browser.

## Acceptance Criteria
- A student can choose a supported image and see it displayed in the profile avatar.
- A valid picture remains visible after a page refresh and is isolated per signed-in student email.
- Unsupported files and files over 2 MB produce an inline error; the previously saved picture remains unchanged.
- `Change photo` replaces the saved image, and `Remove photo` restores the fallback avatar.
- The profile remains usable with no saved image, invalid storage contents, or browser storage errors.
- The feature is accessible by keyboard and has meaningful image alt text.
- Client lint and production build checks pass, and the upload/replace/remove/persistence flow is verified in the browser.
