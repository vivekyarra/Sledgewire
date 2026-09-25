# Sledgewire

**Hit the service before your credits do.**

Sledgewire is a permissioned adversarial execution rail for agent services. It discovers a real MCP surface, tests bounded failure modes, repairs only evidence-backed structural mismatches, independently validates the repair, executes through SharedOS authority, and returns a signed receipt another agent can verify.

It exposes a **CLI**, **MCP server**, **HTTP MCP endpoint**, and a **SharedNet paid provider loop**.

## 30-second judge path

```bash
npm install
npm run selfcheck
npm test
npm run sharedos:check
```

`selfcheck` runs hostile local MCP fixtures. The expected result is not “everything passes”: clean behavior is `READY`, hostile instructions are `DEGRADED`, malformed/fake-success/oversized responses are `INCOMPATIBLE`, and the receipt must verify.

## Why it is different

Sledgewire does not emit an LLM “trust score.” It records exact checks and uses five states only:

`READY · DEGRADED · INCOMPATIBLE · BLOCKED · UNKNOWN`

The workflow is:

```text
Discover → Attack bounded edges → Diagnose → Bounded repair
        → Independent inspection → Execute → Signed evidence
```

For paid Arena execution, SharedOS is load-bearing. `sledgewire.invoke` separates:

```text
Scout      discover exact target
Mechanic   write candidate repair only
Inspector  validate candidate; cannot modify it
Breaker    invoke exact inspected target/tool
```

A message never creates authority. The dispatcher never inherits target authority.

## Services

| Service | Credits | Purpose |
|---|---:|---|
| `sledgewire.smoke` | **3** | Fast pre-spend reality check |
| `sledgewire.assay` | **8** | Bounded adversarial protocol checks |
| `sledgewire.invoke` | **12** | Evidence-backed repair + independent validation + execution |
| `sledgewire.fleet` | **20** | Test up to six candidate services with bounded concurrency |
| `sledgewire.seal` | **25** | Portable profile-versioned conformance packet |
| `sledgewire.verify` | **free** | Verify a signed receipt |

Prices live in `catalog.json`, the single source of truth.

## CLI

```bash
node bin/sledgewire.mjs selfcheck
node bin/sledgewire.mjs smoke https://target.example/mcp safe_tool
node bin/sledgewire.mjs assay https://target.example/mcp
node bin/sledgewire.mjs seal https://target.example/mcp
node bin/sledgewire.mjs invoke https://target.example/mcp request.json
node bin/sledgewire.mjs fleet targets.json
node bin/sledgewire.mjs verify receipt.json public-key.pem
```

## MCP over stdio

```bash
npm run mcp
```

Tools:

```text
sledgewire.smoke
sledgewire.assay
sledgewire.invoke
sledgewire.seal
sledgewire.fleet
sledgewire.verify
```

## HTTP MCP

```bash
npm run keygen -- .sledgewire/keys
NODE_ENV=production \
SLEDGEWIRE_PRIVATE_KEY_FILE=.sledgewire/keys/ed25519-private.pem \
SLEDGEWIRE_PUBLIC_KEY_FILE=.sledgewire/keys/ed25519-public.pem \
PUBLIC_BASE_URL=https://your-host.example \
PORT=8787 npm run serve
```

Surfaces:

```text
POST /mcp
GET  /health
GET  /catalog.json
GET  /.well-known/agent.json
GET  /public-key
```

Production refuses to start without a persistent Ed25519 signing key.

## Security properties

- Public HTTPS targets by default.
- DNS is resolved first and the selected validated address is pinned into the actual HTTP/TLS connection; redirect following is disabled.
- Loopback, private, link-local, documentation, benchmark, multicast and reserved ranges are denied by default.
- Tool descriptions, schemas and results are untrusted data.
- Response bytes, tool-count and deadlines are bounded.
- Destructive probes fail closed unless explicitly authorized.
- Repair never invents missing semantic values or silently deletes caller fields.
- Payment is bound to buyer seat + payee + exact amount + room + request + service memo.
- One transaction cannot buy two request fingerprints; exact completed retries return cached delivery.
- SharedOS bounded grants use atomic SQLite counters and all decisions go to a durable audit/outbox store.
- Paid Arena success must carry a SharedOS trace and signed receipt.

See `SECURITY.md` and `docs/THREAT_MODEL.md`.

## SharedNet Arena provider

After authenticating SharedNet and joining the real competition room:

```bash
export NODE_ENV=production
export SLEDGEWIRE_DB=/persistent/sledgewire.db
export SHAREDNET_SEAT=i_XXXXXXXXXX
export SHAREDNET_ROOM_ID=rom_XXXXXXXXXX
export SHAREDNET_PAYEE_ADDRESS=p_XXXXXXXXXX
export SLEDGEWIRE_PRIVATE_KEY_FILE=/run/secrets/sledgewire-ed25519-private.pem
export SLEDGEWIRE_PUBLIC_KEY_FILE=/run/secrets/sledgewire-ed25519-public.pem

npx -y sharednet@latest reach public
npx -y sharednet@latest watch --on message \
  --run 'npm run --silent arena:serve' --reply --as "$SHAREDNET_SEAT"
```

A buyer sends `sledgewire.service.request.v1`. Without payment, Sledgewire returns the exact price, payee, request-specific memo and payment command. The buyer resends the same request with `payment_txn_id`; Sledgewire verifies the native ledger before executing.

See `docs/PROTOCOL.md` and `docs/DEPLOYMENT.md`.

## Verification gates

The hardened local core currently passes **90 automated tests**, hostile-fixture selfcheck, and a 2,000-workflow / concurrency-64 load harness with zero infrastructure failures. Those timings are local harness measurements, not claims about SharedNet, SharedOS Cloud or public-network latency.

```bash
npm test
npm run selfcheck
npm run stress -- 2000 64
npm run sharedos:check
npm run preflight
```

Before the Arena:

```bash
npm run preflight -- --live
```

The live gate intentionally fails until real seat/payee/room, persistent signing key, external other-seat call, and—when the SharedOS track is enabled—confirmed decision-event visibility exist. Those facts are never fabricated by the repository.

## Non-claims

`READY` does **not** mean factual truth, global security, legal compliance, or absence of vulnerabilities. It means the exact checks written into that receipt passed for that target at that time.

## Documentation

- `docs/ARENA_RUNBOOK.md` — autonomous Round 1 / Round 2 behavior
- `docs/DEPLOYMENT.md` — HTTP, SharedNet and SharedOS deployment
- `docs/PROTOCOL.md` — paid Room message contract
- `docs/RELEASE_CHECKLIST.md` — stop/go gates
- `docs/SHAREDNET_COLLAB.md` — build-room collaboration evidence protocol
- `docs/STRESS_REPORT.md` — executed red-team results and limitations
- `docs/SUBMISSION.md` — submission draft
- `docs/THREAT_MODEL.md` — hostile-input and asset model

## License

MIT.
