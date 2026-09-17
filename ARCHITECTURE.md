# WAJOOD V2 — Independent Architecture

## Goal
AppDeploy is no longer the source of truth. GitHub is the canonical source; hosting can be replaced without changing trading logic.

## Runtime
- `frontend/` — Vite SPA, mobile/iPhone friendly.
- `backend/` — Node API, broker credentials server-side only.
- `engine/` — pure deterministic decision logic; no UI, broker SDK or hosting dependency.
- `tests/` — regression and safety tests.
- `docs/` — operational and deployment notes.

## Decision pipeline
OBSERVE → DATA QUALITY → MARKET CONTEXT → REGIME → TECHNICAL → OPTION CHAIN/OI → PANIC GUARD → EXPIRY HUNTER → CHALLENGE → DECISION → RISK GATE → EXECUTION GATE

## Safety invariants
1. Missing/stale market data cannot create a live BUY.
2. NO TRADE is a valid terminal decision.
3. Shadow/Paper modes never call broker order APIs.
4. Daily realized-loss cap is ₹5,000.
5. Static-IP and explicit live-trading gates remain mandatory.
6. Astrology is an isolated research context and cannot override market/risk/execution decisions.
7. Broker credentials and access tokens never enter frontend code or Git.

## Current baseline
Migrated from AppDeploy snapshot `1789624590125` on 2026-09-17. The existing AppDeploy deployment remains the production fallback while this independent runtime is built and verified.
