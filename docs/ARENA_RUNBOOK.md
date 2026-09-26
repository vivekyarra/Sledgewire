# Trial Zero Arena runbook

## One sentence

Give me the MCP service you are about to trust. Sledgewire calls the real surface, attacks bounded failure modes, repairs only what evidence supports, executes paid work under SharedOS authority, and gives you a receipt you can verify yourself.

Do not lead with architecture.

## Before humans step away

1. Freeze the exact green commit.
2. Run npm run preflight -- --submission.
3. Record the real development SHAREDNET_BUILD_ROOM_ID and collaboration evidence.
4. Deploy HTTPS and verify /arena.md, /mcp and /public-key externally.
5. Join the organizer-provided Arena Room with the competition Instance.
6. Run npm run preflight -- --live.
7. Start npm run arena:daemon.
8. Start the representative agent with docs/ARENA_AGENT_PROMPT.md. The provider daemon posts one durable, idempotent availability announcement by default; do not duplicate that pitch manually unless `SLEDGEWIRE_ARENA_ANNOUNCE=0`.
9. Perform a real other-seat purchase and receipt verification.
10. Reboot once and prove cursor/payment state survives.

## Arena 1

- Post one concise pitch and the one-link quickstart.
- Use free selfcheck as the first demonstration.
- Let peers verify the receipt, then use free `sledgewire.trace` on a paid receipt so authority evidence is independently inspectable.
- Try peer services with real tasks and provide evidence-based critiques.
- Respond to challenges with exact tests and traces.
- Keep Room noise low.

## Arena 2

Paid menu: Smoke 3, Assay 8, Invoke 12, Fleet 20, Seal 25, Gauntlet 35. Free surfaces: `sledgewire.quote`, `sledgewire.selfcheck`, `sledgewire.trace`, `sledgewire.verify`.

Only sell the service justified by the buyer's unresolved problem. Payment -> exact verification -> SharedOS -> signed delivery. No valid payment means no paid execution.

Use `npm run arena:stats` against the live `SLEDGEWIRE_DB` to inspect aggregate earned credits, verified paid buyers, completed-delivery buyers, paid/delivered service mix, smoke-to-premium conversion, delivery p50/p95, failures, and receipt/trace evidence coverage. It never prints buyer identifiers.

## Internal latency targets

| Service | p95 target | hard deadline |
|---|---:|---:|
| Smoke | <25s | 40s |
| Assay | <60s | 90s |
| Invoke | <90s | 120s |
| Fleet | <180s | 240s |
| Seal | <150s | 180s |
| Gauntlet | <210s | 270s |

## Stop conditions

Do not enter autonomous competition until all are true:

- zero unauthorized target actions in the hostile suite;
- zero duplicate paid executions in replay stress;
- production key persistent;
- official Arena Room explicit and separate from build Room;
- native SharedNet purse/ledger readable;
- another seat can purchase, verify the receipt, and retrieve its sanitized SharedOS trace proof;
- SharedOS allow/deny/maxUses check green;
- 60-minute no-human rehearsal green;
- `npm run arena:stats` shows sane zero/positive aggregate counters and no malformed completed rows before handoff.
