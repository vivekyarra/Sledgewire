# Trial Zero release checklist

## Static code gates — v0.3.2

- [x] CLI and MCP.
- [x] One-link `/arena.md` and machine-readable `/arena.json`.
- [x] Free selfcheck and deterministic quote.
- [x] Paid ladder 3 / 8 / 12 / 20 / 25 / 35.
- [x] Production public MCP blocks free execution of paid services and returns signed PAYMENT_REQUIRED routing.
- [x] Persistent signing key required in production.
- [x] DNS validation, IP pinning, redirect refusal and byte/deadline limits.
- [x] Evidence-bounded repair plus independent inspection.
- [x] SharedOS bounded-use state and durable audit/outbox.
- [x] Invoke and Gauntlet optional invocation use separated Scout/Mechanic/Inspector/Breaker authority.
- [x] Direct current SharedNet V1 adapter with bounded transient retries.
- [x] Guest `rit_` invite join and owner-only returned seat-token persistence.
- [x] Compatible member/Instance token loading from environment or ignored owner-only file.
- [x] SharedNet wait uses only documented `after` + `timeout`.
- [x] Separate build and Arena Room variables.
- [x] Native credit-ledger payment validation and atomic transaction/request binding.
- [x] Configured payee checked against active SharedNet identity.
- [x] Arena cursor/message persistence and retry ownership.
- [x] Deterministic reply idempotency.
- [x] Oversized signed delivery artifact fallback.
- [x] SharedNet secrets excluded from git and Docker context.
- [x] **122 / 122** automated tests green on the v0.3.2 branch.
- [x] **2,000 / 2,000** MCP stress workflows at concurrency 64, 0 failures.
- [x] **1,000** payment claims + 1,000 cached retries + 500 wrong-buyer rejections, 0 duplicate paid executions.
- [x] SharedOS deny / allow / maxUses / durable-audit check green.
- [x] Static preflight green.
- [x] Production missing-key fail-closed check green.

## Submission P0

- [ ] Actual SharedNet development Room used by multiple build agents.
- [ ] `SHAREDNET_BUILD_ROOM_ID` recorded.
- [ ] Real collaboration message IDs preserved.
- [ ] Participant/team name and contact final.
- [ ] Public HTTPS `/arena.md` product link final.
- [ ] `npm run preflight -- --submission` green.
- [ ] Submit only once.

## Arena P0

- [ ] Exact green competition commit frozen.
- [ ] Organizer-provided Arena Room configured separately from build Room.
- [ ] Competition seat joined via `npm run arena:join` or an already-valid seat token.
- [ ] Invite token removed from runtime after seat token is stored.
- [ ] Sledgewire payee verified against current SharedNet Principal/Agent/Instance.
- [ ] Native purse and ledger readable.
- [ ] Persistent SQLite survives process restart.
- [ ] Another seat completes request -> payment -> SharedOS -> signed reply.
- [ ] Exact completed retry after restart returns cached delivery with zero re-execution.
- [ ] Oversized artifact delivery path verified live.
- [ ] At least three real external MCP implementations tested.
- [ ] Event-visible SharedOS evidence confirmed if entering that track.
- [ ] Representative agent follows `docs/ARENA_AGENT_PROMPT.md`.
- [ ] 60-minute no-human rehearsal passes.
- [ ] Real Smoke p95 below 25 seconds and all paid calls below hard deadlines.
