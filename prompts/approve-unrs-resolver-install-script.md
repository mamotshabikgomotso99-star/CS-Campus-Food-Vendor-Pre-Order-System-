# Approve `unrs-resolver` Install Script

## Objective
Remove the Vercel install warning that `unrs-resolver@1.12.2` has an install script that is not covered by the project's approval policy.

## Current Findings
- `unrs-resolver@1.12.2` is present in `client/package-lock.json` and declares an install script.
- The Next.js build is run from the client project, so the approval belongs in `client/package.json`.
- npm documents `npm install-scripts approve <pkg>` as the supported way to update `allowScripts`; approvals can be pinned to an installed package version.
- Local npm is 11.16.0 and does not recognize `npm install-scripts`, so do not claim local confirmation of the warning's resolution.

## Scope
- Permit the install script only for the reviewed, locked `unrs-resolver@1.12.2` version using the npm-supported `allowScripts` format.
- Do not approve all scripts, use a global npm setting, or change unrelated dependencies, lockfiles, or build configuration.
- Preserve existing package manifest contents and user changes.

## Acceptance Criteria
- `client/package.json` contains a version-pinned approval for `unrs-resolver@1.12.2`.
- The manifest remains valid JSON and the client production build succeeds.
- Report that a Vercel deployment is still needed to confirm the hosted install warning is gone, because local npm 11.16.0 lacks the approval command shown in the deploy log.