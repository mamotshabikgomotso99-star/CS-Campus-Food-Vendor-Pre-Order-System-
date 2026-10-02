# Menu Item Picture Upload

## Objective
Allow vendors to attach, replace, and remove a picture on each menu item, and show the picture in student menu browsing.

## Current Findings
- Vendor menu create/edit is authenticated and persisted in PostgreSQL; public student menu reads return available menu items.
- Menu items currently have no image columns or upload endpoint. Vendor editing and student browsing use an icon/static image fallback.
- No external image-storage service is configured or approved.

## Scope
- Add a versioned PostgreSQL migration to store an optional image MIME type and image bytes on a menu item. Preserve all existing rows and images must survive API restarts.
- Accept JPEG, PNG, and WebP only, with a 2 MB maximum. Use multipart upload parsing with a memory buffer and server-side MIME plus file-signature validation; never trust the client-provided MIME type alone.
- Support optional image upload when creating a menu item and replacing/removing the image when editing. An invalid or failed image update must preserve the existing image and produce a readable error.
- Keep image access vendor-scoped for the owning vendor, including unavailable menu items. Public student image reads are allowed only for available menu items, using a separate image endpoint and appropriate content type/cache headers.
- Return optional image URLs with vendor/public menu API records. Display uploaded images in vendor menu management and student vendor detail cards; use the existing item fallback imagery/icon when no image exists.
- Keep order pricing, item availability, discount calculations, and order snapshots unchanged. Do not add external storage, image transformation, other profile/avatar behavior, or unrelated UI changes.
- Revoke any browser object URLs used for local previews; provide accessible file input, preview, replace, remove, and inline validation states.

## Acceptance Criteria
- A vendor can upload an allowed image when adding or editing an owned item; it remains visible after refresh and API restart.
- JPEG, PNG, and WebP uploads up to 2 MB are accepted; unsupported, malformed, spoofed-MIME, and oversized files are rejected without replacing the previous saved image.
- Vendor image routes reject unauthenticated requests and cross-vendor access; an owning vendor can preview images for available and unavailable items.
- Student browsing displays an uploaded image for available items and receives no public image for unavailable items; existing items without images keep their fallback.
- Removing an image clears it without deleting the item or affecting order history.
- Focused tests cover upload validation, persistence, vendor ownership, student availability visibility, and image removal; client lint/build and browser upload/replace/remove checks pass.
