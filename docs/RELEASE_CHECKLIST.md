# Trial Zero release checklist

## Static code gates

- [x] CLI and MCP.
- [x] One-link /arena.md and machine-readable /arena.json.
- [x] Free selfcheck and deterministic quote.
- [x] Paid ladder 3 / 8 / 12 / 20 / 25 / 35.
- [x] Production public MCP blocks free execution of paid services and returns PAYMENT_REQUIRED routing.
- [x] Persistent signing key required in production.
- [x] DNS validation, IP pinning, redirect refusal and byte/deadline limits.
- [x] Evidence-bounded repair plus independent inspection.
- [x] SharedOS bounded-use store and durable audit/outbox.
- [x] Invoke and Gauntlet optional invocation use separated Scout/Mechanic/Inspector/Breaker authority.
- [x] Direct current SharedNet V1 API adapter with transient retry handling.
- [x] Guest rit_ invite join path and owner-only returned seat-token storage.
- [x] SharedNet wait uses only documented after + timeout.
- [x] Separate build and Arena Room variables.
- [x] Native credit-ledger payment validation and atomic transaction/request binding.
- [x] Configured payee checked against active SharedNet identity.
- [x] Arena cursor/message persistence and retry ownership.
- [x] Oversized delivery artifact fallback.
- [x] Secrets ignored from git/docker context.
- [x] CI runs tests, hostile selfcheck, 2,000-workflow MCP stress, 1,000-payment replay stress, economy sensitivity, SharedOS checks and preflight.

## Submission P0

- [ ] Actual SharedNet development Room used by multiple build agents.
- [ ] SHAREDNET_BUILD_ROOM_ID recorded.
- [ ] Real collaboration message IDs preserved.
- [ ] Participant name and contact final.
- [ ] Public HTTPS /arena.md link final.
- [ ] Submission preflight green.
- [ ] Submit only once.

## Arena P0

- [ ] Exact green competition commit frozen.
- [ ] Organizer-provided Arena Room configured separately from build Room.
- [ ] Competition seat joined via arena:join or an already-valid member/Instance token.
- [ ] Invite token removed from runtime after seat token is stored.
- [ ] Sledgewire payee verified against current SharedNet identity.
- [ ] Native purse and ledger readable.
- [ ] Persistent SQLite survives restart.
- [ ] Another seat completes request -> payment -> SharedOS -> signed reply.
- [ ] Exact completed retry after restart returns cached delivery with zero re-execution.
- [ ] Oversized artifact delivery path verified live.
- [ ] At least three real external MCP implementations tested.
- [ ] Event-visible SharedOS evidence confirmed if entering that track.
- [ ] Representative agent follows docs/ARENA_AGENT_PROMPT.md.
- [ ] 60-minute no-human rehearsal passes.
- [ ] Real Smoke p95 below 25 seconds and all paid calls below hard deadlines.
