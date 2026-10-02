# Fix Missing Client Icon Dependency

## Objective
Fix the Vercel production build failure where Next.js cannot resolve `lucide-react` from client application files.

## Current Findings
- Client components import `lucide-react` throughout the app.
- `lucide-react` is currently declared in the repository-root `package.json` and root lockfile, not in `client/package.json` or `client/package-lock.json`.
- Vercel installs dependencies for the configured client app, so the icon package is missing during that build.
- `client/package.json` already includes the pinned `allowScripts` approval for `unrs-resolver@1.12.2`; preserve it.

## Scope
- Make `lucide-react` a dependency of the client app and update its client lockfile using npm.
- Remove the misplaced root dependency and update the root lockfile only if needed to reflect that move.
- Preserve all other dependencies, scripts, and existing user changes.
- Do not modify application components or attempt unrelated build warning cleanup.

## Acceptance Criteria
- `client/package.json` and `client/package-lock.json` both include `lucide-react` at a compatible version.
- The root package manifest/lock no longer carries the dependency if it is used only by the client.
- A clean client install followed by `npm run build` resolves all `lucide-react` imports.
- Preserve and validate the existing `unrs-resolver@1.12.2` install-script approval.