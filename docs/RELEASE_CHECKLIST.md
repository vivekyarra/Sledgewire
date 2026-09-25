# Trial Zero release checklist

## Static code gates

- [x] CLI and MCP.
- [x] One-link `/arena.md` and machine-readable `/arena.json`.
- [x] Free selfcheck and deterministic quote.
- [x] Paid ladder 3 / 8 / 12 / 20 / 25 / 35.
- [x] Production public MCP cannot execute paid services without Arena payment; it returns PAYMENT_REQUIRED routing.
- [x] Persistent signing key required in production.
- [x] DNS validation, IP pinning, redirect refusal and byte/deadline limits.
- [x] Evidence-bounded repair plus independent inspection.
- [x] SharedOS current package path, atomic bounded-use store and durable audit/outbox.
- [x] Direct current SharedNet V1 HTTP adapter; tokens never on argv.
- [x] Guest `rit_` invite join path with owner-only seat-token persistence.
- [x] Separate build and Arena Room environment variables.
- [x] Native credit-ledger payment validation and atomic transaction/request binding.
- [x] Configured payee must match the active SharedNet Principal/Agent/Instance in live preflight.
- [x] Arena cursor/message persistence and retry ownership.
- [x] Deterministic reply idempotency.
- [x] Oversized signed delivery automatically becomes a Room-addressed SharedNet artifact.
- [x] CI: 118 tests, hostile selfcheck, 2,000-workflow MCP stress, 1,000-payment replay stress, economy sensitivity, SharedOS allow/deny/maxUses, static preflight.

## Submission P0

- [ ] Actual SharedNet development Room used by multiple build agents.
- [ ] `SHAREDNET_BUILD_ROOM_ID` recorded.
- [ ] Real collaboration message IDs preserved.
- [ ] Participant name and contact final.
- [ ] Public HTTPS `/arena.md` product link final.
- [ ] `npm run preflight -- --submission` green.
- [ ] Submit only once.

## Arena P0

- [ ] Exact green competition commit frozen.
- [ ] Organizer-provided `SHAREDNET_ARENA_ROOM_ID` configured separately from build Room.
- [ ] Competition seat joined with `npm run arena:join` or an already-valid member/Instance token.
- [ ] Invite token removed from runtime after member token is stored.
- [ ] Sledgewire payee address verified against current SharedNet identity.
- [ ] Native purse and ledger readable.
- [ ] Persistent SQLite survives process restart.
- [ ] Another seat completes request -> payment -> SharedOS -> signed reply.
- [ ] Exact completed retry after restart returns cached delivery with zero re-execution.
- [ ] Oversized delivery artifact path tested live.
- [ ] At least three real external MCP implementations tested.
- [ ] SharedOS event visibility confirmed when entering the optional SharedOS track.
- [ ] Representative agent follows `docs/ARENA_AGENT_PROMPT.md`.
- [ ] 60-minute no-human rehearsal passes.
- [ ] Real Smoke p95 below 25 seconds and all paid calls below hard deadlines.
