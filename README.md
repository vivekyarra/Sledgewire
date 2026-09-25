# Sledgewire

**Hit the service before your credits do.**

Sledgewire is a permissioned adversarial execution rail for agent services. It discovers a real MCP surface, attacks bounded failure modes, repairs only evidence-backed structural mismatches, independently validates repair, executes paid work through SharedOS authority, and returns a signed receipt another agent can verify.

Trial Zero v0.3.7 is built around the organizer's actual competition shape: one product link, agents operating both Arena rounds without human intervention, a required SharedNet development Room, a separate organizer Arena Room, and Arena 2 ranking by valid credits earned.

## Fastest judge path

Give another agent one URL:

    https://<deployment>/arena.md

Fastest proof is free:

    MCP tool: sledgewire.selfcheck
    arguments: {}

It runs current-protocol and hostile fixtures and returns a signed receipt.

If the agent does not know which paid service is relevant:

    MCP tool: sledgewire.quote
    arguments: {"intent":"preflight","endpoint":"https://target.example/mcp"}

## Services

| Service | Credits | Purpose |
|---|---:|---|
| sledgewire.quote | free | Deterministic service selection plus request template |
| sledgewire.selfcheck | free | Reproducible hostile-fixture product proof |
| sledgewire.smoke | 3 | Fast pre-spend reality check |
| sledgewire.assay | 8 | Bounded adversarial protocol checks |
| sledgewire.invoke | 12 | Evidence-backed repair + independent inspection + execution |
| sledgewire.fleet | 20 | Test up to six candidate services |
| sledgewire.seal | 25 | Portable profile-versioned conformance packet |
| sledgewire.gauntlet | 35 | Seller-grade dossier: Smoke + Assay + optional staged Invoke + Seal |
| sledgewire.trace | free | Retrieve a sanitized signed SharedOS trace proof from a paid receipt |
| sledgewire.verify | free | Verify a signed receipt |

Prices live only in catalog.json.

## Five factual states, no made-up trust score

    READY
    DEGRADED
    INCOMPATIBLE
    BLOCKED
    UNKNOWN

READY means only that the exact checks recorded in that receipt passed for that target at that time.

## SharedOS authority separation

Paid Invoke, and Gauntlet's optional real invocation, use:

    Scout      discover exact target
    Mechanic   produce candidate structural repair
    Inspector  independently validate; cannot edit candidate
    Breaker    invoke exact inspected target/tool

The dispatcher never inherits target authority. A Room message never creates authority.

Every paid receipt carries a `sharedos_trace_id`. Another agent can call free `sledgewire.trace` with that id to retrieve a sanitized, signed audit proof without exposing host metadata or raw target arguments.


MCP compatibility: **2026-07-28 stateless `server/discover` first, with required modern request/result headers and envelopes, `x-mcp-header` mirroring, and bounded legacy 2025 fallback.** An official MCP v2 client is exercised in CI.

## CLI

Requires Node 22.18+.

    npm install
    node bin/sledgewire.mjs selfcheck
    node bin/sledgewire.mjs quote preflight https://target.example/mcp
    node bin/sledgewire.mjs smoke https://target.example/mcp safe_tool --safe
    node bin/sledgewire.mjs assay https://target.example/mcp
    node bin/sledgewire.mjs seal https://target.example/mcp
    node bin/sledgewire.mjs gauntlet https://target.example/mcp
    node bin/sledgewire.mjs invoke https://target.example/mcp request.json
    node bin/sledgewire.mjs fleet targets.json
    node bin/sledgewire.mjs verify receipt.json public-key.pem

## Public MCP / HTTP

    npm run keygen -- .sledgewire/keys

    NODE_ENV=production \
    SLEDGEWIRE_DB=/persistent/sledgewire.db \
    SLEDGEWIRE_PRIVATE_KEY_FILE=.sledgewire/keys/ed25519-private.pem \
    SLEDGEWIRE_PUBLIC_KEY_FILE=.sledgewire/keys/ed25519-public.pem \
    PUBLIC_BASE_URL=https://your-host.example \
    PORT=8787 npm run serve

Surfaces:

    POST /mcp
    GET  /arena.md
    GET  /arena.json
    GET  /health
    GET  /ready
    GET  /catalog.json
    GET  /.well-known/agent.json
    GET  /public-key

In production, free quote/selfcheck/trace/verify remain directly callable. Paid public MCP calls do **not** execute for free; they return a signed PAYMENT_REQUIRED object routing the caller to the official SharedNet Arena payment path.

## SharedNet Room separation

The submitted development collaboration Room and the organizer's competition Arena Room are intentionally different variables:

    SHAREDNET_BUILD_ROOM_ID
    SHAREDNET_ARENA_ROOM_ID

Submission preflight checks the development Room field. Live Arena preflight checks the competition Room and rejects an accidental reuse when both are present.

## Join the organizer Arena as a guest seat

Current SharedNet supports an invite-only guest flow with no account/API key requirement. Keep the invite out of prompts and argv:

    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_INVITE_TOKEN=rit_...
    export SHAREDNET_MEMBER_TOKEN_FILE=/run/secrets/sledgewire-sharednet-seat
    npm run arena:join

The returned seat token is written mode 0600 and never printed. Remove the invite token from the environment afterward.

## Run the autonomous provider

    export NODE_ENV=production
    export SLEDGEWIRE_DB=/persistent/sledgewire.db
    export SHAREDNET_MEMBER_TOKEN_FILE=/run/secrets/sledgewire-sharednet-seat
    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_PAYEE_ADDRESS=pri_...
    export PUBLIC_BASE_URL=https://your-host.example
    export SLEDGEWIRE_PRIVATE_KEY_FILE=/run/secrets/sledgewire-ed25519-private.pem
    export SLEDGEWIRE_PUBLIC_KEY_FILE=/run/secrets/sledgewire-ed25519-public.pem
    npm run arena:daemon

The daemon keeps presence alive, reads the ordered Room log, answers Sledgewire questions, verifies native credit transfers, rejects wrong buyer/payee/amount/room/memo, executes paid services through SharedOS, signs delivery receipts, and persists cursor/payment/message state across restarts. The public MCP process and Arena daemon must mount the same `SLEDGEWIRE_DB` file so `sledgewire.trace` can expose the exact persisted SharedOS trail referenced by a paid receipt.

Large signed deliveries are uploaded as Room-addressed SharedNet artifacts and replaced in chat with a compact artifact link + SHA-256 pointer. The optional SharedNet watch compatibility path uses the same artifact fallback and validates the active payee identity before serving.

## Security properties

- Public HTTPS targets by default.
- DNS validation plus connection-time IP pinning.
- Redirect refusal.
- Private, loopback, link-local, documentation, benchmark, multicast and reserved ranges blocked.
- Tool descriptions, schemas and outputs treated as untrusted data.
- Response bytes, catalog count and deadlines bounded.
- Active probes require explicit caller safety attestation; untrusted target annotations never authorize execution by themselves.
- Destructive probes/invocations require separate explicit destructive authority.
- Repair never invents missing semantic values.
- Payment binds buyer Instance, exact payee proof, integer amount, official Arena Room, request and service memo; request state is scoped by Room + buyer + request id.
- Exact completed retries are cached; duplicate paid execution is blocked.
- A crash leaving paid execution outcome uncertain is never blindly retried.
- Poison Room messages are bounded and dead-lettered instead of permanently blocking the autonomous cursor.
- SharedNet JSON responses are streamed under byte ceilings before parsing, and duplicate ledger lookups are coalesced/cached to resist retry storms.
- Every paid target workflow uses an exact-target SharedOS grant; the dispatcher has no direct target-service authority.
- SharedOS bounded grants use atomic SQLite usage state and durable audit/outbox storage.
- SharedNet secrets stay in environment or owner-only files, never argv/messages/receipts/logs.
- Receipt canonicalization is bounded for depth, nodes, cycles and bytes before signing or verification.
- Production requires persistent Ed25519 signing material.
- `/ready` requires a fresh Arena-daemon heartbeat from the same persistent database, so a dead seller process cannot masquerade as a healthy competition service.
- Paid receipts are independently inspectable through the free, trace-id-scoped `sledgewire.trace` proof surface.

## Verification

    npm test
    npm run selfcheck
    npm run stress -- 10000 128
    npm run stress:arena -- 10000
    npm run stress:dupes -- 1000 16
    npm run economy
    npm run sharedos:check
    npm run preflight
    # after deployment with a distinct buyer seat:
    npm run arena:rehearse

Before submission:

    npm run preflight -- --submission

Before autonomous competition:

    npm run preflight -- --live

Live preflight intentionally remains red until real event facts exist: public deployment, organizer Arena seat, purse/ledger access, correct payee, another-seat purchase, and any required event-visible SharedOS evidence.

For the strongest live gate, run `npm run arena:rehearse` from a distinct buyer seat. It spends one real 3-credit Smoke payment, verifies the deployed signing key and public SharedOS trace proof, then proves an exact retry returns the cached delivery.

## Competition docs

- docs/ORGANIZER_ALIGNMENT.md
- docs/ARENA_AGENT_PROMPT.md
- docs/TOP1_GAMEPLAN.md
- docs/ARENA_RUNBOOK.md
- docs/DEPLOYMENT.md
- docs/PROTOCOL.md
- docs/RELEASE_CHECKLIST.md
- docs/SHAREDNET_COLLAB.md
- docs/STRESS_REPORT.md
- docs/SUBMISSION.md
- docs/THREAT_MODEL.md

## License

MIT.
