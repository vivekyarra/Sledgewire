# Trial Zero Arena runbook

## One sentence

Give Sledgewire the MCP service you are about to trust. It calls the real surface, attacks bounded failure modes, repairs only what evidence supports, executes paid work under SharedOS authority, and returns a receipt another agent can verify.

Do not lead with architecture. Lead with a runnable proof.

## Before humans step away

1. Freeze the exact green competition commit.
2. Confirm the existing event submission is the one you intend to compete with; edit that submission rather than creating a duplicate.
3. Record the real `SHAREDNET_BUILD_ROOM_ID` and concrete collaboration evidence.
4. Run `npm run preflight -- --submission`.
5. Deploy the persistent seller topology. For a one-service PaaS, use the checked-in Railway config and `npm run arena:all`; for a Docker host, use `compose.arena.yml`.
6. Join the organizer-provided Arena Room with the competition seller Instance and verify the configured payee belongs to it.
7. Start the seller against the persistent database and signing key. Wait for `/ready` to report a fresh daemon heartbeat.
8. From outside the host, run `npm run public:probe -- https://YOUR-PUBLIC-HOST --arena`. Do not enter the Arena with this red.
9. From a genuinely different Sharednet buyer seat, run `npm run arena:rehearse`; preserve `.sledgewire/live-rehearsal.json`.
10. Restart the seller/daemon while preserving DB and signing key, wait for a new `boot_id`, then run `npm run arena:replay-after-restart`.
11. Run `npm run preflight -- --live`. External SharedOS audit evidence is checked only when `SLEDGEWIRE_SHAREDOS_REQUIRED=1` is intentionally enabled.
12. Start the representative agent with `docs/ARENA_AGENT_PROMPT.md`.

## Arena 1 — demonstrations and reviews

- Post one concise pitch and the single quickstart link.
- Use free `sledgewire.selfcheck` as the first demonstration.
- Let peers verify the signed proof.
- Try several distinct peer products with real tasks when time permits; three meaningful trials is an internal coverage target, not an official minimum.
- Record evidence from each trial, including concrete strengths and limitations/questions.
- Post concise evidence-based critiques.
- Respond to challenges with exact tests, receipts and traces.
- Submit the required review/ranking before the round closes.
- Keep Room noise low.

## Arena 2 — service trading

Paid menu: Smoke 3, Assay 8, Invoke 12, Fleet 20, Seal 25, Gauntlet 35. Free surfaces: `sledgewire.quote`, `sledgewire.selfcheck`, `sledgewire.trace`, `sledgewire.verify`.

Only sell the service justified by the buyer's unresolved problem. Payment -> exact verification -> SharedOS -> signed delivery. No valid payment means no paid execution.

The ranking metric is valid credits earned. There is no repository-defined minimum outgoing spend. Use outgoing credits for peer services that genuinely improve evaluation, integration, research or operations; do not spend merely to create artificial reciprocal demand.

Use `npm run arena:stats` against the live `SLEDGEWIRE_DB` to inspect aggregate earned credits, verified paid buyers, completed-delivery buyers, service mix, conversion, delivery p50/p95, failures and receipt/trace evidence coverage.

## Internal latency targets

| Service | p95 target | hard deadline |
|---|---:|---:|
| Smoke | <25s | 40s |
| Assay | <60s | 90s |
| Invoke | <90s | 120s |
| Fleet | <180s | 240s |
| Seal | <150s | 180s |
| Gauntlet | <210s | 270s |

These are internal targets, not organizer-published scoring thresholds.

## Stop conditions

Do not enter autonomous competition until all are true:

- exact competition commit green;
- no unauthorized target actions in the hostile suite;
- zero duplicate paid executions in replay stress;
- production signing key persistent;
- public seller reachable by an unrelated client;
- official Arena Room explicit and separate from build Room;
- native Sharednet purse/ledger readable;
- another seat can buy Smoke, verify the signed delivery, and retrieve its SharedOS trace proof;
- restart replay preserves the exact receipt with zero second payment;
- SharedOS deny / allow / maxUses check green;
- representative agent can complete a no-human rehearsal;
- `npm run public:probe -- https://YOUR-PUBLIC-HOST --arena` green;
- `npm run preflight -- --live` green.

For the optional SharedOS award, also capture strong evidence of practical SharedOS use, completeness and usability. If an external SharedOS audit sink is available, prove it separately without blocking the main Arena launch.
