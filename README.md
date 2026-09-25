# Sledgewire

**Hit the service before your credits do.**

Sledgewire is a permissioned adversarial execution rail for agent services. It discovers a real MCP surface, tests bounded failure modes, repairs only evidence-backed structural mismatches, independently validates the repair, executes paid work through SharedOS authority, and returns a signed receipt another agent can verify.

Trial Zero v0.3 is designed around the organizer's actual competition flow: one product link, fully agent-operated Arena rounds, separate development and Arena SharedNet rooms, and valid-credit-first service delivery.

## Fastest judge path

When deployed, send another agent exactly one URL:

    https://<deployment>/arena.md

Fastest proof is the free MCP tool sledgewire.selfcheck with empty arguments. It runs hostile fixtures and returns a signed receipt.

If an agent does not know what to buy, call the free deterministic selector sledgewire.quote with an intent such as preflight, adversarial, repair_execute, compare, certify, or full_dossier.

## Services

| Service | Credits | Purpose |
|---|---:|---|
| sledgewire.quote | free | Deterministic service selection plus exact request template |
| sledgewire.selfcheck | free | Reproducible hostile-fixture product proof |
| sledgewire.smoke | 3 | Fast pre-spend reality check |
| sledgewire.assay | 8 | Bounded adversarial protocol checks |
| sledgewire.invoke | 12 | Evidence-backed repair plus independent validation plus execution |
| sledgewire.fleet | 20 | Test up to six candidate services |
| sledgewire.seal | 25 | Portable profile-versioned conformance packet |
| sledgewire.gauntlet | 35 | Seller-grade full dossier: Smoke plus Assay plus optional Invoke plus Seal |
| sledgewire.verify | free | Verify a signed receipt |

Prices live only in catalog.json.

## Why it is different

Sledgewire never emits an LLM trust percentage. It uses five factual states:

READY · DEGRADED · INCOMPATIBLE · BLOCKED · UNKNOWN

Operational chain:

    Discover -> Attack bounded edges -> Diagnose -> Bounded repair
             -> Independent inspection -> Execute -> Signed evidence

For paid Invoke, SharedOS separates Scout, Mechanic, Inspector, and Breaker. Mechanic cannot certify its own repair; Inspector cannot modify it; Breaker gets only the exact inspected target/tool authority. A Room message never creates authority.

## CLI

Requires Node 22.18 or newer.

    npm install
    node bin/sledgewire.mjs selfcheck
    node bin/sledgewire.mjs quote preflight https://target.example/mcp
    node bin/sledgewire.mjs smoke https://target.example/mcp safe_tool
    node bin/sledgewire.mjs assay https://target.example/mcp
    node bin/sledgewire.mjs seal https://target.example/mcp
    node bin/sledgewire.mjs gauntlet https://target.example/mcp
    node bin/sledgewire.mjs invoke https://target.example/mcp request.json
    node bin/sledgewire.mjs fleet targets.json
    node bin/sledgewire.mjs verify receipt.json public-key.pem

## MCP and HTTP

Run stdio MCP:

    npm run mcp

Public HTTP deployment:

    npm run keygen -- .sledgewire/keys
    NODE_ENV=production     SLEDGEWIRE_PRIVATE_KEY_FILE=.sledgewire/keys/ed25519-private.pem     SLEDGEWIRE_PUBLIC_KEY_FILE=.sledgewire/keys/ed25519-public.pem     PUBLIC_BASE_URL=https://your-host.example     PORT=8787 npm run serve

Surfaces:

    POST /mcp
    GET  /arena.md
    GET  /arena.json
    GET  /health
    GET  /catalog.json
    GET  /.well-known/agent.json
    GET  /public-key

Production refuses to start without persistent Ed25519 signing material.

## SharedNet: build room and Arena room are separate

The organizer requires the development collaboration Room in the submission and supplies a separate competition Arena Room. Sledgewire keeps these as separate variables.

Submission evidence:

    export SHAREDNET_BUILD_ROOM_ID=rom_XXXXXXXXXX
    export SLEDGEWIRE_PARTICIPANT_NAME="Yarra Vivek"
    export SLEDGEWIRE_CONTACT="<contact>"
    export PUBLIC_BASE_URL=https://your-host.example
    npm run preflight -- --submission

Arena runtime:

    export NODE_ENV=production
    export SLEDGEWIRE_DB=/persistent/sledgewire.db
    export SHAREDNET_INSTANCE_TOKEN='sni_...'
    export SHAREDNET_ARENA_ROOM_ID=rom_XXXXXXXXXX
    export SHAREDNET_PAYEE_ADDRESS=p_XXXXXXXXXX
    export PUBLIC_BASE_URL=https://your-host.example
    export SLEDGEWIRE_PRIVATE_KEY_FILE=/run/secrets/sledgewire-ed25519-private.pem
    export SLEDGEWIRE_PUBLIC_KEY_FILE=/run/secrets/sledgewire-ed25519-public.pem
    npm run arena:daemon

The direct Arena daemon uses the documented SharedNet V1 HTTP API, keeps its token only in the environment, joins only the explicit Arena Room, long-polls messages, answers product questions, verifies payments, executes paid services through SharedOS, signs delivery receipts, and persists room cursors/messages across restarts.

A SharedNet watch compatibility path remains available through npm run arena:serve.

## Security properties

- Public HTTPS MCP targets by default.
- Validated DNS plus connection-time IP pinning.
- Redirect refusal.
- Private, loopback, link-local, documentation, benchmark, multicast and reserved ranges blocked.
- Tool descriptions, schemas and outputs treated as untrusted data.
- Response bytes, catalog size and deadlines bounded.
- Destructive or replay probes fail closed unless safety is established.
- Repair never invents semantic values.
- Payment binds buyer Instance, payee perspective, exact amount, official Arena Room, request and service memo.
- One transaction cannot buy two request fingerprints.
- SharedOS bounded grants use atomic SQLite counters and durable audit/outbox storage.
- Paid success carries a SharedOS trace and Ed25519 receipt.
- SharedNet secrets never go into argv, Room messages, receipts, or logs.

## Verification

    npm test
    npm run selfcheck
    npm run stress -- 2000 64
    npm run stress:arena -- 1000
    npm run economy
    npm run sharedos:check
    npm run preflight

Before submission:

    npm run preflight -- --submission

Before autonomous Arena:

    npm run preflight -- --live

Live preflight intentionally fails until real event facts exist: official Arena membership, live purse access, persistent key/storage, an external other-seat call, and—if entering the SharedOS track—confirmed event-visible SharedOS evidence.

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

## Non-claims

READY does not mean factual truth, global security, legal compliance, or absence of vulnerabilities. It means only that the exact checks recorded in that receipt passed for that target at that time.

## License

MIT.
