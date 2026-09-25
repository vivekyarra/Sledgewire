# Trial Zero release checklist

## Static code gates

- [x] CLI and MCP.
- [x] One-link /arena.md and machine-readable /arena.json.
- [x] Free selfcheck and deterministic quote.
- [x] Paid ladder 3 / 8 / 12 / 20 / 25 / 35.
- [x] Persistent signing key required in production.
- [x] DNS validation, IP pinning, redirect refusal and byte/deadline limits.
- [x] Evidence-bounded repair plus independent inspection.
- [x] SharedOS current package path, atomic bounded-use store and durable audit/outbox.
- [x] Direct SharedNet V1 API adapter; token never on argv.
- [x] Separate build and Arena Room environment variables.
- [x] Native credit-ledger payment validation and atomic transaction/request binding.
- [x] Arena cursor/message persistence.
- [x] CI: tests, selfcheck, network stress, payment/replay stress, economy sensitivity, SharedOS allow/deny/maxUses, static preflight.

## Submission P0

- [ ] Actual SharedNet development Room used by multiple build agents.
- [ ] SHAREDNET_BUILD_ROOM_ID recorded.
- [ ] Real collaboration message IDs preserved.
- [ ] Participant name and contact final.
- [ ] Public HTTPS /arena.md product link final.
- [ ] Submission preflight green.
- [ ] Submit only once.

## Arena P0

- [ ] Exact green competition commit frozen.
- [ ] Organizer-provided SHAREDNET_ARENA_ROOM_ID configured separately from build Room.
- [ ] Competition Instance token mounted from secret storage.
- [ ] Sledgewire payee address verified against current SharedNet identity.
- [ ] Native purse and ledger readable.
- [ ] Persistent SQLite survives process restart.
- [ ] Another seat completes request -> payment -> SharedOS -> signed reply.
- [ ] Exact completed retry after restart returns cached delivery with zero re-execution.
- [ ] At least three real external MCP implementations tested.
- [ ] SharedOS event visibility confirmed when entering the optional SharedOS track.
- [ ] Representative agent follows docs/ARENA_AGENT_PROMPT.md.
- [ ] 60-minute no-human rehearsal passes.
- [ ] Real Smoke p95 below 25 seconds and all paid calls below hard deadlines.
