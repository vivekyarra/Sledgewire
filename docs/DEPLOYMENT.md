# Deployment

v0.3.10 uses a two-process Docker Compose topology plus cryptographically verified second-seat and restart rehearsals. The public server and Arena daemon share one persistent volume so paid outcomes and SharedOS traces survive daemon restarts and remain resolvable through the public `sledgewire.trace` tool.

## Public HTTPS MCP

Generate persistent signing material:

    npm run keygen -- /secure/sledgewire-keys

Start:

    NODE_ENV=production \
    SLEDGEWIRE_DB=/persistent/sledgewire.db \
    SLEDGEWIRE_PRIVATE_KEY_FILE=/secure/sledgewire-keys/ed25519-private.pem \
    SLEDGEWIRE_PUBLIC_KEY_FILE=/secure/sledgewire-keys/ed25519-public.pem \
    PUBLIC_BASE_URL=https://sledgewire.example \
    PORT=8787 npm run serve

Verify externally:

    GET /health
    GET /ready
    GET /arena.md
    GET /arena.json
    GET /.well-known/agent.json
    GET /catalog.json
    GET /public-key
    POST /mcp

Use the deployed /arena.md URL as the submission product link. In production, free quote/selfcheck/trace/verify remain directly callable. Paid MCP calls return a signed PAYMENT_REQUIRED route and do not execute for free. `SLEDGEWIRE_PUBLIC_PAID_EXECUTION=1` is permitted only in a non-production private rehearsal; production startup rejects it.

## SharedNet development Room

Use SharedNet for real agent collaboration during development. Record that Room as SHAREDNET_BUILD_ROOM_ID. Preserve message IDs showing specification handoff, implementation, red-team failure, patch and independent verification. Do not substitute the separate competition Room.

## Join the organizer Arena Room

Current SharedNet supports guest agents joining directly from a Room invite. Keep the organizer invite token out of prompts and argv:

    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_INVITE_TOKEN=rit_...
    export SHAREDNET_MEMBER_TOKEN_FILE=/run/secrets/sledgewire-sharednet-seat
    npm run arena:join

The command uses the invite only in the Authorization header, writes the returned seat token mode 0600, preserves a retry-safe join idempotency record, and never prints the token. Remove SHAREDNET_INVITE_TOKEN from the environment after the seat is established.

If an authenticated sni_ or compatible rmt_ seat token already exists, mount it through SHAREDNET_MEMBER_TOKEN or SHAREDNET_MEMBER_TOKEN_FILE instead.

## SharedNet Arena daemon

    export NODE_ENV=production
    export SLEDGEWIRE_DB=/persistent/sledgewire.db
    export SHAREDNET_BASE_URL=https://www.sharednet.ai
    export SHAREDNET_MEMBER_TOKEN_FILE=/run/secrets/sledgewire-sharednet-seat
    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_PAYEE_ADDRESS=pri_...
    export PUBLIC_BASE_URL=https://sledgewire.example
    export SLEDGEWIRE_PRIVATE_KEY_FILE=/run/secrets/sledgewire-ed25519-private.pem
    export SLEDGEWIRE_PUBLIC_KEY_FILE=/run/secrets/sledgewire-ed25519-public.pem
    npm run arena:daemon

The daemon resolves the active identity, requires the payee to belong to that Principal/Agent/Instance, joins only the explicit Arena Room, keeps presence alive, long-polls the ordered log, verifies native credit transfers, executes paid work through SharedOS, and persists cursor/payment/message state.

The Room wait request follows the current SharedNet contract exactly: after + timeout, with no undocumented query parameters. Large signed dossiers automatically become Room-addressed SharedNet artifacts with a compact SHA-256 pointer.

## Watch compatibility mode

If the event runtime already uses SharedNet watch:

    npx -y sharednet@latest watch --on message --run 'npm run --silent arena:serve' --reply

The direct daemon remains preferred because cursor persistence and poison-message recovery stay inside Sledgewire. Watch compatibility now requires exactly one event per reply invocation, verifies the configured payee against the active SharedNet identity, joins only the configured Arena Room, and uses the same artifact fallback for oversized signed deliveries.

## SharedOS

Every paid Arena service is mediated by the embedded SharedOS kernel. Invoke, and Gauntlet's optional real invocation, use Scout -> Mechanic -> Inspector -> Breaker authority separation.

The public MCP server and Arena daemon must mount the **same persistent `SLEDGEWIRE_DB`**. Paid receipts include `sharedos_trace_id`; free `sledgewire.trace` resolves that id against the shared durable audit store and returns only a sanitized signed proof. This is independent peer evidence for the embedded SharedOS boundary, not a claim that an external SharedOS Cloud sink has accepted the events.

## Preflight

Before submission:

    npm run preflight -- --submission

Before autonomous competition, first start the seller daemon, complete the real second-seat rehearsal, restart the daemon, and complete the restart replay proof. Then run the final gate:

    npm run preflight -- --live

The live gate does not trust a manual "external call confirmed" flag. It negotiates the deployed MCP endpoint, verifies a signed free selfcheck and signed paid routing response against the deployed public key, verifies the SharedNet seller identity/payee, validates `.sledgewire/live-rehearsal.json`, and validates `.sledgewire/restart-replay.json` against the current daemon boot. If any of those facts are absent or stale, the gate stays red.

If event-visible external SharedOS evidence is required, do not set `SHAREDOS_AUDIT_CONFIRMED=1` until that external fact has actually happened. Repository trace proofs do not replace an event-required external/visible SharedOS sink.


## Recommended two-process Docker Compose topology

Use the checked-in `compose.arena.yml` so the public MCP process and SharedNet Arena daemon share the same SQLite/WAL volume and signing key:

    npm run keygen -- .sledgewire/keys
    # Place the already-joined seller seat token at:
    # .sharednet/sledgewire-arena-token
    cp deploy/arena.env.example deploy/arena.env
    # edit deploy/arena.env with the real public URL, Arena Room and payee
    docker compose --env-file deploy/arena.env -f compose.arena.yml up -d --build

The public process exposes port 8787. Put TLS/reverse-proxying in front of it and make `PUBLIC_BASE_URL` exactly match the external HTTPS origin. The MCP route validates both Origin and Host/authority in production. If a trusted reverse proxy rewrites Host, list only that explicit authority in `SLEDGEWIRE_ALLOWED_HOSTS`.

The Compose file mounts the same named `sledgewire-data` volume into both processes at `/persistent`. Do not replace that with separate ephemeral filesystems.

## Real second-seat no-human rehearsal

The repository now has an actual buyer-side rehearsal. It is not a mock and consumes one real Smoke payment (3 credits); the exact retry reuses the same transaction and must return the cached signed delivery without re-executing.

Prepare a different SharedNet buyer seat token:

    export SHAREDNET_BUYER_TOKEN_FILE=/secure/buyer-seat-token
    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_PAYEE_ADDRESS=pri_...
    export PUBLIC_BASE_URL=https://sledgewire.example

Then run:

    npm run arena:rehearse

By default the rehearsal Smoke-tests the public Sledgewire MCP endpoint itself. Override with a different public MCP target:

    export SLEDGEWIRE_REHEARSAL_TARGET=https://another-public-mcp.example/mcp

A successful rehearsal proves, in one automated path: second-seat Room request, buyer-bound signed PAYMENT_REQUIRED quote, native SharedNet transfer, paid Room request, SharedOS-mediated execution, signed delivery verification against the deployed public key, public `sledgewire.trace` lookup, trace proof signature verification, and exact paid retry returning the identical cached receipt. The hardened evidence schema is `sledgewire.live-rehearsal.v3`.

The redacted evidence packet is written mode 0600 to `.sledgewire/live-rehearsal.json` by default. It never stores the buyer seat token.


## Liveness vs full Arena readiness

`GET /health` is process liveness and remains 200 while the public HTTP process itself is alive. `GET /ready` is stricter: when an Arena Room is configured it requires a fresh readiness pulse written by the separate Arena daemon into the shared SQLite database. After startup, that pulse is refreshed only after the daemon successfully heartbeats to SharedNet and confirms access to the configured Arena Room; if those external checks stop succeeding, readiness ages out after 45 seconds.

This catches the dangerous split-brain case where the product link looks healthy but no seller process is actually consuming paid SharedNet requests. The final live preflight additionally negotiates `/mcp`, verifies a signed selfcheck and signed paid routing response, and validates the paid rehearsal/restart evidence against the deployed key and current daemon boot.


## Prove restart-safe replay with zero additional credits

The first live rehearsal now records the seller daemon's random process `boot_id` from `/ready`. After the rehearsal succeeds, restart the **Arena daemon** while preserving the same database and signing-key mounts:

    docker compose --env-file deploy/arena.env -f compose.arena.yml restart arena-daemon

Wait until `GET /ready` is green again, then run from the same buyer seat:

    npm run arena:replay-after-restart

This command refuses to run unless the current daemon `boot_id` differs from the one captured by `arena:rehearse`. It makes **no second payment**. It resends the exact original paid request and requires the original signed receipt and SharedOS trace to survive byte-identically across the restart. If the DB volume or signing key was lost, or the provider executes again instead of replaying the cache, the proof fails.

The restart proof is written mode 0600 to `.sledgewire/restart-replay.json` using schema `sledgewire.restart-replay-proof.v2`.
