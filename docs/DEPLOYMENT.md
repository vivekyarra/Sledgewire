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

Use the deployed /arena.md URL as the submission product link. In production, free quote/selfcheck/verify remain directly callable. Paid MCP calls return a signed PAYMENT_REQUIRED route and do not execute for free. SLEDGEWIRE_PUBLIC_PAID_EXECUTION=1 is for private rehearsal only.

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

The direct daemon is preferred because cursor persistence, exact Room selection, payment verification and deterministic delivery idempotency remain inside Sledgewire.

## SharedOS

Every paid Arena service is mediated by the embedded SharedOS kernel. Invoke, and Gauntlet's optional real invocation, use Scout -> Mechanic -> Inspector -> Breaker authority separation.

## Preflight

Before submission:

    npm run preflight -- --submission

Before autonomous competition:

    npm run preflight -- --live

Never set SHAREDNET_EXTERNAL_CALL_CONFIRMED or SHAREDOS_AUDIT_CONFIRMED until those live facts have actually happened.
