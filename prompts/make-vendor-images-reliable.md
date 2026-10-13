# Make vendor images reliable in development and production

## Goal
Ensure vendor cards always display the intended food imagery in the student dashboard and vendor-discovery page, including after deployment. Images must not depend on an external hotlink being available, and API image failures must fall back gracefully without blank or broken image boxes.

## Confirmed current state
- The local live menu API returns 24 items with no `imageUrl` values.
- The local vendor listing now uses Unsplash URL fallbacks and all four images currently load in the local browser.
- The production Vercel login page currently reports that it is configured with a local API URL. That prevents vendor data from loading in production, so images cannot appear there regardless of the image component.
- The documented `https://campus-eats-api.onrender.com/api/health` currently returns 404 and must not be used as the production API URL until the correct API deployment is verified.

## Implementation requirements

### 1) Use committed, same-origin image assets
- Add approved, optimized vendor cover images to `client/public/vendor-covers/` so they ship with every Vercel deployment and do not depend on Unsplash or another runtime image host.
- Use distinct food imagery that matches Fresh Bites, Mama's Corner, Student Cafe, and Sunset Snacks. Do not add external hotlink URLs as the only image source.
- Keep image dimensions/aspect ratio stable and make the displayed food subject legible with `object-cover`.
- Add no API secrets, account data, or copyrighted third-party assets without appropriate permission.

### 2) Centralize vendor image selection and failure handling
- Use a small shared vendor-cover mapping/component across the student dashboard and `/student/vendors` so those surfaces cannot drift.
- Prefer an uploaded `imageUrl` supplied by the API when present.
- If an uploaded URL fails to load, fall back to the committed local vendor cover for that vendor. If no mapped image exists, render a deliberate local visual fallback rather than a broken-image icon or empty box.
- Avoid infinite `onError` loops; switch once to the local fallback and then to the neutral fallback if that asset also fails.
- Preserve accessible alt text and stable image dimensions.

### 3) Keep the data/API boundary clear
- Do not invent vendor records, menu items, availability, ratings, or API image data to make the cards look populated.
- Keep product imagery separate from authoritative menu, price, availability, and order data.
- Do not point production builds at localhost or silently fall back to mock vendor data when the API is unavailable.

### 4) Correct production API configuration and diagnostics
- Keep the existing production guard for a `NEXT_PUBLIC_API_URL` that resolves to localhost.
- Document in `README.md` that Vercel Preview and Production both need the actual deployed API origin as `NEXT_PUBLIC_API_URL`, without an `/api` suffix, followed by a redeploy.
- Document that the configured API must return `{"success":true,"status":"ok"}` from `/api/health` before production vendor data can load.
- Do not guess or hard-code a Render hostname. The actual public API origin must be verified from the deployed service settings. `CLIENT_URL` must be configured on the API to the frontend origin for credentialed CORS and sessions.
- If the actual API URL is unknown or its health endpoint is not valid, surface that as a deployment prerequisite rather than changing CORS to wildcard or showing fabricated data.

## Acceptance criteria
- With the API available and returning vendor records without images, all four seeded vendor covers render from same-origin local files in the student dashboard and vendor listing.
- API-provided vendor image URLs render when valid and fall back to local covers when invalid or unavailable.
- The browser shows no broken image requests, and image dimensions do not cause card layout shifts.
- Images remain available with external image hosts blocked/offline.
- A production deployment configured with localhost or a non-API origin shows a clear API configuration error; it does not pretend the vendor catalogue is empty or fall back to mock records.
- Vercel setup instructions identify the required Preview and Production API-origin settings without embedding secrets.

## Verification
- Run client lint, typecheck, and production build.
- Run a browser check for `/student/dashboard` and `/student/vendors` on desktop and mobile; assert four vendor-cover images load and have non-zero natural dimensions.
- Simulate a broken API image URL and confirm it falls back to the matching local cover.
- Confirm the currently configured Render API host only becomes the documented production value after `/api/health` returns the expected JSON response.
