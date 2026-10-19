# Fix Vercel Client Deployment Build

## Objective
Fix the current client production-build failures that prevent the Campus Eats frontend from deploying to Vercel. Keep the work limited to verified frontend build blockers and any additional errors exposed by the required checks.

## Execution constraints
- Follow the repository `AGENTS.md`, `client/AGENTS.md`, and `PROJECT_CONTRACT.md`.
- Preserve the established Campus Eats UI, behavior, APIs, and dependencies; avoid unrelated refactors.
- Before changing Next.js-specific code or configuration, read the relevant documentation shipped with the installed Next.js version under `client/node_modules/next/dist/docs/`.
- Do not deploy, push, commit, alter hosting settings, or request or expose secrets.
- Preserve the existing Vercel deployment guidance: project Root Directory `client`, Node.js 22, and `NEXT_PUBLIC_API_URL` set to the public API base URL without `/api`.

## Verified findings
- `npm --prefix client run build` fails in `client/components/admin/VendorRequestsPanel.tsx` due to duplicated and malformed function/JSX fragments, including unmatched `finally` blocks.
- `client/lib/api.ts` contains a duplicated, incomplete `reviewVendorRequest` declaration.
- `client/components/auth/LoginForm.tsx` has repeated imports for `saveAuthIdentity`, validation helpers, and `AuthInput`.
- The worktree was clean before creating this prompt.
- Root `README.md` already documents Vercel's client Root Directory, Node.js version, and API URL requirements. Do not add `vercel.json` unless validation proves it is needed.

## Scope
- Repair the malformed/duplicated code in the affected client modules while preserving intended behavior and public API contracts.
- Run client lint, typecheck, and production build; fix any additional concrete client errors those checks expose that block deployment.
- Keep warning-only or unrelated application issues out of scope unless they prevent the Vercel build.
- Review the final diff and summarize any remaining provider configuration or runtime requirements that cannot be verified locally.

## Acceptance criteria
- `npm --prefix client run lint` exits successfully.
- `npm --prefix client run typecheck` exits successfully.
- `npm --prefix client run build` completes successfully.
- No unrelated features, credentials, or deployment settings are changed.
- Report the exact Vercel project settings still required, based on the existing README, and distinguish build success from successful hosted deployment/runtime integration.
