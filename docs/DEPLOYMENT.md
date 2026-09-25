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

The submission product link should be the deployed /arena.md URL because the organizer explicitly prefers one link that another agent can understand and follow.

## SharedNet development Room

Use SharedNet for real agent collaboration during development. Record that Room as:

    SHAREDNET_BUILD_ROOM_ID=rom_XXXXXXXXXX

Preserve message IDs that show specification handoff, implementation, red-team failure, patch, and independent verification. This is the Room ID submitted with the project.

Do not reuse the build-room variable for competition.

## SharedNet Arena daemon

Use the separate organizer-provided Arena Room:

    export NODE_ENV=production
    export SLEDGEWIRE_DB=/persistent/sledgewire.db
    export SHAREDNET_BASE_URL=https://www.sharednet.ai
    export SHAREDNET_INSTANCE_TOKEN='sni_...'
    export SHAREDNET_ARENA_ROOM_ID=rom_XXXXXXXXXX
    export SHAREDNET_PAYEE_ADDRESS=p_XXXXXXXXXX
    export PUBLIC_BASE_URL=https://sledgewire.example
    export SLEDGEWIRE_PRIVATE_KEY_FILE=/run/secrets/sledgewire-ed25519-private.pem
    export SLEDGEWIRE_PUBLIC_KEY_FILE=/run/secrets/sledgewire-ed25519-public.pem
    npm run arena:daemon

The Instance token remains in the environment and is never passed on argv. The daemon talks directly to the SharedNet V1 HTTP API: current identity, join, heartbeat, wait, post, purse and credit-transfer ledger.

## Watch compatibility mode

If the event runtime is already using SharedNet watch, the one-shot handler remains available:

    npx -y sharednet@latest watch --on message --run 'npm run --silent arena:serve' --reply

The direct daemon is preferred because cursor persistence and exact Room selection remain inside Sledgewire.

## SharedOS

Every paid Arena service is mediated by the embedded SharedOS kernel. Invoke additionally uses separated Scout -> Mechanic -> Inspector -> Breaker stages.

The durable SQLite store supplies bounded-use consumption and audit persistence. External SharedOS Cloud visibility is event-integration specific. Configure the organizer/design-partner endpoint with SHAREDOS_AUDIT_URL and SHAREDOS_KEY, then flush the durable outbox with npm run audit:flush.

## Preflight

Before project submission:

    npm run preflight -- --submission

Before autonomous competition:

    npm run preflight -- --live

Never set SHAREDNET_EXTERNAL_CALL_CONFIRMED or SHAREDOS_AUDIT_CONFIRMED until the corresponding live event has actually happened.
