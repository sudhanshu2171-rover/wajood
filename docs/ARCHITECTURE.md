# WAJOOD V2 — Independent Architecture

## Source of truth

GitHub is authoritative for application source, tests, architecture notes, and release history. Hosting providers are deployment targets only.

## Runtime boundaries

```text
                 ┌──────────────────────┐
                 │       WAJOOD UI      │
                 │ Desktop / Mobile /  │
                 │ iPhone Browser       │
                 └──────────┬───────────┘
                            │ HTTPS
                            ▼
                 ┌──────────────────────┐
                 │     WAJOOD API       │
                 │ Auth / broker / data │
                 │ execution boundary   │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
         Zerodha        Market/news     Persistence
          adapter        adapters       / journals
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                 ┌──────────────────────┐
                 │   WAJOOD ENGINE      │
                 │ deterministic logic  │
                 └──────────────────────┘
```

## Decision pipeline

OBSERVE → DATA QUALITY → MARKET CONTEXT → REGIME → TECHNICAL → OPTION CHAIN/OI → PANIC GUARD → EXPIRY HUNTER → CHALLENGE → DECISION → RISK GATE → EXECUTION GATE

## Broker isolation

Broker-specific SDK/client code must stay behind an adapter. The engine must never import Zerodha-specific modules directly. This keeps backtesting, shadow mode, and future broker migration independent.

## Safety boundaries

- Daily risk cap remains ₹5,000 unless explicitly changed in configuration.
- NO TRADE is terminal until a new observation changes the decision.
- AUTO LIVE requires all execution gates to pass.
- Shadow/Paper modes must never place broker orders.
- Secrets belong only in deployment environment variables / secret stores.

## Migration from AppDeploy

The existing AppDeploy application remains the live UI while this repository becomes the source of truth. No AppDeploy deployment is required for the repository migration, and the exhausted AppDeploy deployment quota must not be retried.

## Planned deployment targets

Frontend can be deployed to a static/edge host such as Cloudflare Pages/Workers or another equivalent provider. Backend can run as a Node service/container on a host such as Render, Fly.io, Railway, or an equivalent provider. The codebase must remain provider-neutral.
