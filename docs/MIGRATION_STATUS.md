# WAJOOD Migration Status

## Phase 1 — completed

- GitHub repository created and writable.
- README established.
- Independent architecture documented.
- AppDeploy is no longer treated as the only source of truth.

## Current baseline

- Live AppDeploy snapshot remains `1789624590125`.
- AppDeploy deployment quota is exhausted at 125/125 on the Free plan; no further deploy requests should be made unless the account limit increases.
- The latest live application should remain unchanged while migration work proceeds.

## Phase 2 — next

1. Export/sync the latest application source from AppDeploy snapshot `1789624590125`.
2. Remove the UI's direct dependency on `@appdeploy/client` by introducing an API abstraction.
3. Split the current monolith into frontend/backend/engine boundaries.
4. Preserve existing WAJOOD features and regression tests.
5. Add GitHub Actions for build/test checks.
6. Deploy the frontend/backend independently after local and CI validation.

## Critical migration rule

Do not change trading logic merely for the infrastructure migration. Existing risk gates, Panic Guard, Expiry Hunter, Shadow/Paper behavior, and live-order protections must remain behaviorally equivalent unless a change is intentionally reviewed and tested.
