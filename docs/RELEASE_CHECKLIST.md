# Trial Zero release checklist

## Code gates — implemented
- [x] Exact service schemas and prices live in one catalog.
- [x] `@aicoo/sharedos` pinned to `1.0.0-preview`.
- [x] Canonical dispatcher/scout/breaker/mechanic/inspector role identities defined.
- [x] Purpose fixed to `sledgewire.test-repair-and-invoke-agent-services`.
- [x] Atomic bounded-use SharedOS store + durable audit/outbox.
- [x] SharedNet native ledger adapter and Room watcher handler.
- [x] Buyer/payee/price/room/request/service memo binding.
- [x] Restart-safe SQLite payment/request state model.
- [x] Production fail-closed signing-key policy.
- [x] Connection-time DNS pinning + redirect refusal.
- [x] Bounded concurrency for Fleet.
- [x] Profile-versioned Seal check IDs.
- [x] CI: tests, hostile selfcheck, load run, SharedOS allow/deny check, static preflight.

## Live P0 — must pass before competition
- [ ] Freeze the exact green commit used for deployment.
- [ ] Real SharedNet competition Room joined with the published Sledgewire seat.
- [ ] Another SharedNet seat completes request → payment → SharedOS → signed reply.
- [ ] Persistent DB survives restart and exact retry returns cached response with zero re-execution.
- [ ] Persistent Ed25519 public key published and private key mounted from secret storage.
- [ ] At least three real MCP implementations tested.
- [ ] SharedOS event visibility integration confirmed with a real Sledgewire trace if entering the SharedOS track.
- [ ] 60-minute no-human autonomous rehearsal passes.
- [ ] Smoke p95 <25s on real targets; all paid calls finish under the event cap.

## Arena conversion
- [x] Free selfcheck emits a verifiable receipt.
- [x] `smoke=3`, `assay=8`, `invoke=12`, `fleet=20`, `seal=25` in one source of truth.
- [x] No generic numeric trust score.
- [x] Portable seller-facing Seal packet.
- [ ] Capture real buyer feedback and tune only if it improves autonomous comprehension.

## SharedNet collaboration prize
- [ ] Build Room ID recorded.
- [ ] At least three real handoff chains preserved with message IDs.
- [ ] Red-team agent produces a real failing artifact that builder fixes.
- [ ] Independent verifier reruns acceptance tests after the patch.
