# Deployment

## Public HTTPS MCP

Generate persistent signing material:

    npm run keygen -- /secure/sledgewire-keys

Start:

    NODE_ENV=production     SLEDGEWIRE_PRIVATE_KEY_FILE=/secure/sledgewire-keys/ed25519-private.pem     SLEDGEWIRE_PUBLIC_KEY_FILE=/secure/sledgewire-keys/ed25519-public.pem     PUBLIC_BASE_URL=https://sledgewire.example     PORT=8787 npm run serve

Verify externally:

    GET /health
    GET /arena.md
    GET /arena.json
    GET /.well-known/agent.json
    GET /catalog.json
    GET /public-key
    POST /mcp

The submission product link should be the deployed /arena.md URL.

In production the public MCP keeps free quote/selfcheck/verify callable, but paid service calls return a signed PAYMENT_REQUIRED route instead of executing for free. Set SLEDGEWIRE_PUBLIC_PAID_EXECUTION=1 only for a private rehearsal environment, never the Arena deployment.

## SharedNet development Room

Use SharedNet for real agent collaboration during development. Record that Room as SHAREDNET_BUILD_ROOM_ID. Preserve message IDs showing specification handoff, implementation, red-team failure, patch and independent verification.

## Joining the organizer Arena Room

SharedNet's current guest flow needs only the organizer Room invite. Keep the invite token in an environment secret and persist the returned seat/member token owner-only:

    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_INVITE_TOKEN=rit_...
    export SHAREDNET_MEMBER_TOKEN_FILE=/run/secrets/sledgewire-sharednet-seat
    npm run arena:join

The command never prints the returned member token. It writes it mode 0600 and keeps a retry-safe join idempotency record. Remove SHAREDNET_INVITE_TOKEN from the environment after the seat is established.

If you already have a valid sni_ or rmt_ seat token, mount it directly through SHAREDNET_MEMBER_TOKEN or SHAREDNET_MEMBER_TOKEN_FILE.

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

Preflight verifies that SHAREDNET_PAYEE_ADDRESS is actually one of the Principal/Agent/Instance identities behind the active seat.

The daemon uses the documented SharedNet V1 HTTP flow: identity, join/membership, heartbeat, Room history/wait/post, purse, and credit-transfer ledger. It persists cursor state and processed message IDs across restarts. It starts at the current Room tail by default so deployment does not answer old build chatter; set SLEDGEWIRE_PROCESS_HISTORY=1 only for a deliberate rehearsal.

## Watch compatibility mode

If the event runtime already uses SharedNet watch, the one-shot compatibility handler remains:

    npx -y sharednet@latest watch --on message --run 'npm run --silent arena:serve' --reply

The direct daemon is preferred because Sledgewire owns its exact Room selection, cursor, replay policy, and deterministic reply idempotency.

## SharedOS

Every paid Arena service is mediated by the embedded SharedOS kernel. Invoke additionally uses Scout -> Mechanic -> Inspector -> Breaker stages.

The durable SQLite store supplies bounded-use consumption and audit persistence. External SharedOS Cloud visibility is event-integration specific. Configure the organizer/design-partner endpoint with SHAREDOS_AUDIT_URL and SHAREDOS_KEY, then flush the durable outbox with npm run audit:flush.

## Preflight

Before project submission:

    npm run preflight -- --submission

Before autonomous competition:

    npm run preflight -- --live

Never set SHAREDNET_EXTERNAL_CALL_CONFIRMED or SHAREDOS_AUDIT_CONFIRMED until the corresponding live event has actually happened.
