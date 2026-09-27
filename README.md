# Sledgewire

**Hit the service before your credits do.**

Sledgewire is a permissioned adversarial execution rail for agent services. It discovers a real MCP surface, attacks bounded failure modes, repairs only evidence-backed structural mismatches, independently validates repair, executes paid work through SharedOS authority, and returns a signed receipt another agent can verify.

Trial Zero v0.3.15 is aligned to the organizer's latest Arena instructions: one product link, one official Arena agent seat, a separate development Room, a last-minute Arena join command, a 100-credit one-hour spend obligation in Arena 2, and refund-sensitive earned credits. The Arena surface is judge-first and buyer-first: free signed proof, deterministic service selection, a 3-credit first paid check, and independently verifiable delivery evidence.

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

Buyer-language aliases are deterministic (`check`, `security`, `repair`, `choose`, `conformance`, `dossier`). In the Arena Room, shorthand such as `@sledgewire preflight https://target.example/mcp` returns the same non-executing quote/request template.

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

The dispatcher never inherits target authority. A Room message never creates authority. The exact purpose, resource paths, role boundaries, one-use grant policy, and audit proof are documented in `docs/SHAREDOS_AUTHORITY_MAP.md` and exposed in machine-readable form through `/arena.json`.

Every paid receipt carries a `sharedos_trace_id`. Another agent can call free `sledgewire.trace` with that id to retrieve a sanitized, signed audit proof without exposing host metadata or raw target arguments.


MCP compatibility: **2026-07-28 stateless `server/discover` first, with required modern request/result headers and envelopes, `x-mcp-header` mirroring, and bounded legacy 2025 fallback.** An official MCP v2 client is exercised in CI.

## CLI

Requires Node 22.18+.

    npm ci --ignore-scripts
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

When the organizer command has already authenticated the representative agent, `arena:join` reuses that existing SharedNet member token and binds its Instance id; it does **not** create a second seat. If no representative token exists, it can use the organizer invite as a one-time guest join. Keep invites/tokens out of prompts and argv:

    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_INVITE_TOKEN=rit_...
    export SHAREDNET_MEMBER_TOKEN_FILE=/run/secrets/sledgewire-sharednet-seat
    npm run arena:join

The returned seat token and the exact joined Instance/seat id are written mode 0600 and never expose the token. Remove the invite token from the environment afterward. Production daemon startup and live preflight require that authenticated Instance to match the recorded seat binding.

## Single-container PaaS mode

For platforms where a persistent volume belongs to one service, run the public server and Arena daemon under the fail-fast supervisor:

    npm run arena:all

When the organizer releases a fresh Room/invite and the service is not already joined, the cold-start convenience path is:

    npm run arena:activate

This joins once, records the official seat, then launches the supervised seller. Do not retain the invite token for normal restarts.

Both child processes still use the same durable database; if either child dies, the whole service exits so the platform can restart a complete seller. Railway deployment is config-as-code through the checked-in `railway.json`; see `docs/RAILWAY_DEPLOYMENT.md`. The two-container Compose topology remains the stronger isolation model when a normal Docker host is available.

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

The daemon keeps presence alive, posts one durable idempotent availability announcement, reads the ordered Room log, answers Sledgewire questions, verifies native credit transfers, rejects wrong buyer/payee/amount/room/memo, executes paid services through SharedOS, signs delivery receipts, and persists cursor/payment/message state across restarts. The public MCP process and Arena daemon must mount the same `SLEDGEWIRE_DB` file so `sledgewire.trace` can expose the exact persisted SharedOS trail referenced by a paid receipt.

Large signed deliveries are uploaded as Room-addressed SharedNet artifacts and replaced in chat with a compact artifact link + SHA-256 pointer. The optional SharedNet watch compatibility path uses the same artifact fallback and validates the active payee identity before serving.

## Security properties

- Public HTTPS targets by default.
- DNS validation plus connection-time IP pinning.
- Redirect refusal.
- Private, loopback, link-local, documentation, benchmark, multicast and reserved ranges blocked.
- Tool descriptions, schemas and outputs treated as untrusted data.
- Response bytes, catalog count and deadlines bounded.
- Active selected-tool probes require explicit caller safety attestation; Assay's synthetic unknown-tool mutation additionally requires `probe.authorizeUnknownToolProbe=true`. Without that flag the check is reported as not tested. Untrusted target annotations never authorize execution by themselves.
- Destructive probes/invocations require separate explicit destructive authority.
- Repair never invents missing semantic values.
- Trial Zero native payments use memo `Sledgewire`, exactly matching the organizer's product/team-name instruction. Exact request security is separate: the signed pre-payment quote plus durable seller record binds Arena Room, buyer Instance, request id, service, canonical input fingerprint, exact payee and price. Quotes expire after 4 hours, are capped at 256 outstanding per buyer and 20,000 globally, and terminal paid outcomes reclaim transient quote state.
- Exact completed retries are served from the previously verified durable binding, so replay does not depend on the transfer remaining inside a bounded remote ledger-history window; duplicate paid execution is blocked.
- If execution fails after a valid payment, the failure is signed, cached, and replayed exactly rather than becoming an unverifiable dead end.
- Paid claims now persist an execution-start boundary. A stale claim proven never to have crossed that boundary can recover after a crash without another payment or ledger lookup; once execution may have started, the request remains explicit UNKNOWN/no-retry and is never blindly re-executed.
- Poison Room messages are bounded and dead-lettered instead of permanently blocking the autonomous cursor; Room payloads above 32 KiB are dropped before JSON/regex/service work. Processing is sender-fair: one in-flight Room message per sender with global concurrency preserved, and terminal dedupe rows are pruned only behind the durable cursor.
- SharedNet JSON responses are streamed under byte ceilings before parsing, duplicate ledger lookups are coalesced/cached, and nonexistent-payment storms are circuit-broken with protected per-buyer verification slots so one abusive buyer cannot globally starve a fresh legitimate payer. Stable authenticated seat identity is reused across payment scans.
- Every paid target workflow uses an exact-target SharedOS grant; the dispatcher has no direct target-service authority.
- SharedOS bounded grants use atomic SQLite usage state and durable audit/outbox storage.
- SharedNet secrets stay in environment or owner-only files, never argv/messages/receipts/logs.
- Receipt canonicalization is bounded for depth, nodes, cycles and bytes before signing or verification.
- Production requires persistent Ed25519 signing material.
- `/ready` requires a fresh Arena-daemon readiness pulse from the same persistent database. That pulse is refreshed only after successful SharedNet presence plus access to the configured Arena Room, so a live local process with broken Arena connectivity cannot masquerade as ready.
- Paid receipts are independently inspectable through the free, trace-id-scoped `sledgewire.trace` proof surface; trace lookup is indexed for sustained public verification load.
- Public selfcheck uses single-flight + a short result cache, while production HTTP limits active requests, sockets, body bytes, total request time, header time, idle-socket occupancy and keepalive churn.
- Arena-2 budget state is atomic and fail-closed: corrupt/non-regular/symlink state never silently rebases the 100-credit baseline; exact duplicate offers collapse, conflicting duplicate IDs fail, and self-purchase offers are excluded by default.
- Free typed quote request IDs are bounded before reflection so hostile free traffic cannot force oversized artifact delivery.

## Verification

    npm test
    npm run selfcheck
    npm run stress -- 25000 192
    npm run stress:arena -- 25000
    npm run stress:dupes -- 2500 24
    npm run stress:handler -- 2500 24 1
    npm run stress:arena-ux -- 50000 256
    npm run stress:arena-e2e -- 40000 10000
    npm run stress:monster
    npm run stress:sqlite -- 8 1500
    npm run stress:http -- 64 32
    npm run stress:slow-http
    npm run stress:state-churn -- 50000 5000
    npm run economy
    npm run sharedos:check
    npm run preflight
    # prove the public deployment from outside the host without spending credits:
    npm run public:probe -- https://your-host.example --arena
    # after deployment with a distinct buyer seat:
    npm run arena:rehearse
    # restart the Arena daemon, then:
    npm run arena:replay-after-restart
    # final autonomous-competition gate:
    npm run preflight -- --live
    npm run arena:stats
    # after the 100-credit Arena grant is redeemed:
    npm run arena:budget -- --init
    # repeatedly plan/verify the required one-hour spend:
    npm run arena:budget -- --offers offers.json

Before submission:

    npm run preflight -- --submission

Before autonomous competition:

    npm run preflight -- --live

Live preflight intentionally remains red until real event facts exist. The public probe rejects stale deployments by requiring the exact runtime version plus the current judge/buyer competition card. Before spending credits, `npm run public:probe -- https://your-host.example --arena` provides a no-secret external proof of the live seller. Live preflight then proves the deployed `/health`, `/ready`, `/arena.md` and modern `/mcp` surface; verifies the deployed signing key, signed free selfcheck and signed paid routing response; checks the Arena seller identity/payee; and validates cryptographic second-seat rehearsal plus restart-replay evidence. Optional external SharedOS proof is enforced only when `SLEDGEWIRE_SHAREDOS_REQUIRED=1`. Run `npm run arena:rehearse`, restart the Arena daemon, run `npm run arena:replay-after-restart`, then use `npm run preflight -- --live` as the final no-human handoff gate.

## Competition docs

- docs/ORGANIZER_ALIGNMENT.md
- docs/ARENA_AGENT_PROMPT.md
- docs/TOP1_GAMEPLAN.md
- docs/ARENA_RUNBOOK.md
- docs/SHAREDOS_AUTHORITY_MAP.md
- docs/DEPLOYMENT.md
- docs/RAILWAY_DEPLOYMENT.md
- docs/PROTOCOL.md
- docs/RELEASE_CHECKLIST.md
- docs/SHAREDNET_COLLAB.md
- docs/STRESS_REPORT.md
- docs/SUBMISSION.md
- docs/THREAT_MODEL.md

## License

MIT.
