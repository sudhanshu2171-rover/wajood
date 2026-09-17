# WAJOOD V2

Independent source-of-truth repository for the WAJOOD trading decision engine.

## Architecture

- `frontend/` — web/mobile UI
- `backend/` — broker/data API boundary
- `engine/` — decision pipeline and risk logic
- `tests/` — regression and QA scenarios
- `docs/` — architecture and deployment notes

## Decision pipeline

OBSERVE → DATA QUALITY → MARKET CONTEXT → REGIME → TECHNICAL → OPTION CHAIN/OI → PANIC GUARD → EXPIRY HUNTER → CHALLENGE → DECISION → RISK GATE → EXECUTION GATE

## Deployment principle

GitHub is the source of truth. App hosting is replaceable and must not contain the only copy of WAJOOD source code.

> Live trading credentials and broker secrets must never be committed to this repository.
