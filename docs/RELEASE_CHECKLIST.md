# Trial Zero release checklist

## Static code gates — v0.3.4

- [x] CLI and MCP with current 2026-07-28 stateless `server/discover` plus bounded legacy fallback.
- [x] Modern fallback refuses to hide timeouts/internal errors as legacy compatibility.
- [x] Modern header/body/method/name/session consistency checks.
- [x] One-link `/arena.md`, machine-readable `/arena.json`, free selfcheck and deterministic quote.
- [x] Paid ladder 3 / 8 / 12 / 20 / 25 / 35.
- [x] Production paid-MCP bypass is impossible; CI explicitly tests startup rejection.
- [x] Persistent signing key required in production.
- [x] DNS validation, connection-time IP pinning, redirects refused, expanded IPv4/IPv6 private/reserved/NAT64/6to4 blocking.
- [x] Active probes require explicit caller safety attestation; destructive calls need explicit destructive authority.
- [x] Evidence-bounded repair, independent inspection, suspicious metadata downgrade.
- [x] Receipt verifier fails closed on malformed public keys/signatures.
- [x] Every paid target network workflow uses an exact-target SharedOS grant; dispatcher has no direct target authority.
- [x] Invoke/Gauntlet real execution preserves Scout -> Mechanic -> Inspector -> Breaker authority separation.
- [x] SharedOS bounded-use state and durable audit/outbox.
- [x] Direct current SharedNet V1 adapter with bounded transient retries and bounded response-body parsing.
- [x] Guest `rit_` join and owner-only returned seat-token persistence.
- [x] Separate development and Arena Rooms.
- [x] Native credit-ledger buyer/payee/amount/room/memo binding and one-use transaction/request binding.
- [x] Exact completed retry caching; stale uncertain paid executions never blindly re-execute.
- [x] Arena cursor/message persistence, bounded retries, poison-message dead-letter.
- [x] Oversized signed delivery artifact fallback with validated artifact response.
- [x] SharedNet secrets excluded from git and Docker context.
- [x] **171 / 171** automated tests green on v0.3.4 branch.
- [x] **5,000 / 5,000** MCP stress workflows at concurrency **96**, 0 failures.
- [x] **5,000** payment claims + 5,000 cached retries + 500 wrong-buyer rejections, 0 duplicate paid executions.
- [x] Duplicate storm: **12,500 authorization attempts**, 500 unique claims, 5,500 in-flight duplicates refused, 6,000 cached replays, 500 transaction-reuse attempts refused, 0 duplicate paid executions.
- [x] SQLite close/reopen replay and two-connection one-use tests green.
- [x] SharedOS deny / allow / maxUses / durable-audit check green.
- [x] Static preflight green; live preflight additionally requires production mode and disabled paid bypass.

## Submission P0

- [ ] Actual SharedNet development Room used by multiple build agents.
- [ ] `SHAREDNET_BUILD_ROOM_ID` recorded and real collaboration message IDs preserved.
- [ ] Participant/team name and contact final.
- [ ] Public HTTPS `/arena.md` product link final and accessible to an unrelated agent.
- [ ] `npm run preflight -- --submission` green.
- [ ] Submit only once.

## Arena P0

- [ ] Exact green competition commit frozen.
- [ ] Organizer Arena Room configured separately from build Room.
- [ ] Competition seat joined; invite token removed afterward.
- [ ] Payee verified against current SharedNet identity; purse/ledger readable.
- [ ] Another seat completes request -> payment -> SharedOS -> signed reply.
- [ ] Exact completed retry after restart returns cached delivery with zero re-execution.
- [ ] Oversized artifact delivery verified live.
- [ ] At least three real external MCP implementations tested.
- [ ] Event-visible SharedOS evidence confirmed if entering that track.
- [ ] Representative agent follows `docs/ARENA_AGENT_PROMPT.md`.
- [ ] 60-minute no-human rehearsal passes.
- [ ] Real Smoke p95 below 25 seconds and all paid calls below hard deadlines.
