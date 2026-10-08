# Complete Campus Eats for Production Readiness

## Objective
Bring Campus Eats from its current prototype and persistent ordering slice to the release gates in `PROJECT_CONTRACT.md`, without claiming production readiness until every applicable gate is verified.

## Execution rules
- Follow the repository `AGENTS.md` workflow and this project contract. Work in small, reviewable phases; get approval before implementation.
- Preserve the established Campus Eats UI and avoid unrelated refactors.
- Keep prices, availability, totals, permissions, and order transitions server-authoritative. Do not replace missing integrations with fake success behavior.
- Never expose secrets or request passwords, API keys, database URLs, or signing keys in chat. Use secure environment configuration and terminal prompts where applicable.
- Do not commit or deploy without explicit approval. Report any production requirement blocked by missing provider decisions, infrastructure, or access.

## Delivery sequence
1. **Baseline and deployment foundation**: run existing checks; inventory environment variables; document the client/API/database deployment topology, CORS origins, cookie behavior, migrations, backups, and staging/production configuration. Treat Vercel as the frontend host only unless an API deployment is explicitly configured.
2. **Identity and access**: complete verified registration, login/logout/session handling, password recovery, protected student/vendor routes, role authorization, and ownership checks. Keep secrets and credentials server-only.
3. **Live vendor and menu data**: implement vendor profile/operating-hours/collection-location/preparation settings and connect student discovery, vendor menu pages, and dashboards to APIs. Remove mock records from production paths.
4. **Student ordering**: complete cart, collection-slot selection, checkout validation, idempotent order creation, server-calculated totals, and clear loading/error/success states.
5. **Vendor fulfilment and tracking**: complete order queue/detail, authorized state transitions with history, student order tracking, collection confirmation, cancellation/rejection behavior, and order history.
6. **Explicit external-service decisions**: before integration, obtain approval for email/verification/reset service, payment versus pay-on-collection policy, and notification channel. Document choices and implement failure/retry behavior; do not silently choose a provider or simulate success.
7. **Operations and reporting**: add admin roles/routes, vendor approval/suspension, account/order support, audit events, and contract-defined metrics with privacy-conscious exports.
8. **Release assurance**: add CI for typecheck/lint/tests/build, critical end-to-end journeys, authorization/security review, accessibility/performance checks, monitoring, backup/restore validation, staging pilot, runbook, rollback, and release checklist.

## Acceptance criteria
- Each contract MVP and production release gate is mapped to implemented behavior and tests.
- No production workflow depends on mock dashboard or menu records.
- Student and vendor journeys work end-to-end against a production-like database and configured API.
- API CORS and secure session-cookie behavior are verified for the actual client and API domains.
- Automated checks pass in a clean environment, with critical authorization and ordering regressions covered.
- External service and policy decisions are recorded; unresolved decisions are blockers, not hidden assumptions.
- A staged deployment plan lists exact required environment variable names, health checks, migrations, smoke tests, monitoring, backups, and rollback steps without including secret values.
- Do not describe or deploy the system as production-ready until the contract's production gate is satisfied and accepted.

## User-provided deployment requirements
Before configuring a real deployment, request only non-secret decisions and URLs in chat: target Vercel project/domain, public API host, managed PostgreSQL host, chosen email/notification/payment policy, and intended pilot scope. Have the user enter all secret values directly into the hosting provider's secure environment settings.
