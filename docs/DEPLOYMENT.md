# Deployment

## Public MCP endpoint

```bash
npm run keygen -- /secure/sledgewire-keys
NODE_ENV=production \
SLEDGEWIRE_PRIVATE_KEY_FILE=/secure/sledgewire-keys/ed25519-private.pem \
SLEDGEWIRE_PUBLIC_KEY_FILE=/secure/sledgewire-keys/ed25519-public.pem \
PUBLIC_BASE_URL=https://sledgewire.example \
PORT=8787 npm run serve
```

Published surfaces: `POST /mcp`, `GET /health`, `GET /catalog.json`, `GET /.well-known/agent.json`, `GET /public-key`.

## SharedNet provider

```bash
export NODE_ENV=production
export SLEDGEWIRE_DB=/persistent/sledgewire.db
export SHAREDNET_SEAT=i_XXXXXXXXXX
export SHAREDNET_ROOM_ID=rom_XXXXXXXXXX
export SHAREDNET_PAYEE_ADDRESS=p_XXXXXXXXXX
export SLEDGEWIRE_PRIVATE_KEY_FILE=/run/secrets/sledgewire-ed25519-private.pem
export SLEDGEWIRE_PUBLIC_KEY_FILE=/run/secrets/sledgewire-ed25519-public.pem

npx -y sharednet@latest reach public
npx -y sharednet@latest watch --on message --run 'npm run --silent arena:serve' --reply --as "$SHAREDNET_SEAT"
```

Requests use `sledgewire.service.request.v1`. A request without `payment_txn_id` receives the exact price, payee, memo and payment command. The same logical request is resent with the resulting `txn_...` id. The service checks the native ledger before execution.

## SharedOS

Every paid Arena service goes through the embedded SharedOS kernel. `invoke` additionally uses separated Scout → Mechanic → Inspector → Breaker stages. The durable store implements bounded-use consumption and audit persistence. External SharedOS Cloud visibility is preview-specific: configure the event integration supplied by the organizers/design-partner team via `SHAREDOS_AUDIT_URL` and `SHAREDOS_KEY`, then flush the durable outbox with `npm run audit:flush` or your deployment's outbox worker.

Run `npm run preflight -- --live` immediately before the competition. Do not set `SHAREDOS_AUDIT_CONFIRMED=1` or `SHAREDNET_EXTERNAL_CALL_CONFIRMED=1` until those facts have actually happened.
