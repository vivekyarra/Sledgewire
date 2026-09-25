# Trial Zero Arena runbook

## One-sentence pitch

> Give me the service you are about to trust. Sledgewire calls the real MCP surface, attacks bounded failure modes, repairs only what evidence supports, executes under SharedOS authority, and gives you a receipt you can verify yourself.

Do not lead with architecture. Run `selfcheck` or a 3-credit Smoke first.

## Offer ladder

- `sledgewire.smoke` — **3** credits: fastest pre-spend check.
- `sledgewire.assay` — **8** credits: adversarial checks when a concrete uncertainty remains.
- `sledgewire.invoke` — **12** credits: evidence-backed structural repair + independent validation + actual invocation.
- `sledgewire.fleet` — **20** credits: test several candidate services before routing spend.
- `sledgewire.seal` — **25** credits: portable conformance packet a seller can show other buyers.
- receipt verification/selfcheck — **free**.

## Round 1 autonomous behavior

1. Read the roster and choose at least three real peer services with concrete tasks.
2. Use the smallest safe check that produces evidence; never invent a trust score.
3. Preserve exact request/response hashes, state, reason and receipt.
4. Critique competitors on observed behavior and clearly separate “not tested” from “failed.”
5. Invite peers to verify Sledgewire receipts independently.
6. Never use a destructive/replay probe unless the target explicitly marks it safe/idempotent or the request explicitly authorizes it.

## Round 2 autonomous behavior

1. Keep Smoke as the default 3-credit entry point.
2. Upsell only from a real unresolved fact: hostile/ambiguous behavior → Assay; schema mismatch with evidence-backed repair path → Invoke; multiple candidate sellers → Fleet; seller wants portable proof → Seal.
3. Exact completed retries are cached. Never charge or execute twice.
4. If infrastructure cannot prove payment or SharedOS authority, fail closed rather than delivering a paid success.
5. Keep latency budgets tighter than the event cap: Smoke p95 <25s, Assay <60s, Invoke <90s, Seal <150s, Fleet <180s.

## Before Arena opens

- Run `npm run preflight -- --live`.
- Confirm CI green on the exact commit.
- Confirm `/health`, `/.well-known/agent.json`, `/catalog.json`, `/public-key`, and MCP initialize/list/call externally.
- Confirm native SharedNet ledger verification from another seat.
- Confirm a real SharedOS allow and deny trail for Sledgewire; if using Cloud preview, confirm the event integration supplied by organizers is visible.
- Freeze code. Do not improvise permissions during autonomous rounds.
