# Sledgewire v0.3 stress report

Date: 2026-09-25

This report separates executed evidence from live-event facts. It does not claim an Arena finishing position.

## Current green CI evidence

Branch commit tested: `0975236f84def68f09773d2985928346dbfc086d`.

- Automated tests: **118 / 118 passed**, 0 failed.
- Hostile-fixture selfcheck: **VERIFIED** with signed receipt verification true.
- MCP load harness: **2,000 / 2,000** complete Smoke workflows, concurrency **64**, **0 failures**.
- CI MCP load timings on that runner: p50 **62 ms**, p95 **99 ms**, p99 **371 ms**, total **2.341 s**.
- Arena payment/replay harness: **1,000 claims**, **1,000 cached retries**, **500 wrong-buyer attempts rejected**, **0 duplicate paid executions**, total **150 ms**.
- SharedOS integration check: no grant denied; matching grant allowed; exhausted `maxUses` denied; **9 audit events** persisted.
- Static preflight: **READY**.
- Production signing policy: boot without persistent key fails closed; valid key succeeds.

These timing numbers are local GitHub Actions harness measurements. They are not claims about SharedNet, SharedOS Cloud, the public Internet, or third-party MCP latency.

## Security and organizer-protocol families covered

- hostile tool output and hostile descriptions;
- fake-success envelopes;
- malformed JSON and SSE handling;
- streamed response byte limits;
- oversized tool catalog;
- request deadline;
- redirect refusal;
- public/private/reserved target policy;
- destructive probe refusal;
- unknown-tool acceptance;
- schema-forbidden extra-field acceptance;
- divergent idempotent replay;
- bounded evidence repair and independent repair reproduction;
- receipt signature, tamper and wrong-key failure;
- payment buyer/payee/amount/Arena-room/memo binding;
- exact completed retry caching;
- in-flight duplicate refusal;
- transaction reuse refusal;
- failed-request no-silent-reexecution;
- atomic SharedOS `maxUses` consumption;
- current SharedNet long typed IDs plus legacy short IDs;
- guest invite join with runtime metadata and owner-only returned seat token;
- current SharedNet wait semantics with only documented `after` and `timeout` parameters;
- caller-perspective credit ledger normalization;
- Room cursor/message persistence and recovery;
- deterministic reply idempotency UUIDs;
- public paid-MCP bypass prevention: production public calls return signed PAYMENT_REQUIRED routing rather than executing paid work for free;
- 32 KiB Room-message protection with automatic SharedNet artifact fallback for large signed dossiers;
- free quote routing;
- public selfcheck;
- Gauntlet seller dossier;
- one-link Arena card.

## Defects found during organizer/current-protocol review and fixed

1. **Build and competition Room confusion risk.** The participant guide says the submitted development Room is not the competition Room. Sledgewire now has separate `SHAREDNET_BUILD_ROOM_ID` and `SHAREDNET_ARENA_ROOM_ID` gates.
2. **Invite path mismatch.** Current SharedNet says an agent can join with a `rit_` invite and receives a seat/member token. Added `npm run arena:join`, owner-only token persistence, and retry-safe join state.
3. **Wait query mismatch.** The previous daemon sent an undocumented `limit` parameter to `/wait`. Removed it; tests now assert only `after` and `timeout`.
4. **Public paid-service bypass.** A buyer could otherwise call a paid MCP tool directly and avoid Arena credits. Production public MCP now returns a signed PAYMENT_REQUIRED route; paid execution occurs only after native SharedNet verification.
5. **Large delivery failure.** Gauntlet/Seal receipts can exceed SharedNet's message budget. Sledgewire now uploads oversized signed responses as Room-addressed SharedNet artifacts and posts a compact hash/link pointer.
6. **Autonomous restart ambiguity.** Room messages now have explicit in-flight/completed/failed ownership, retryable failed delivery, persistent cursor state, and deterministic reply idempotency keys.
7. **Payee typo risk.** Live preflight now resolves the active SharedNet identity and requires the configured payee to match that Principal, Agent, or Instance.

## Economy sensitivity

`npm run economy` is arithmetic only, not a forecast. The seller premium lane models Seal and Gauntlet as mutually exclusive because Gauntlet already includes conformance evidence.

For reference, the current model produces **233 modeled credits across 10 peers** in the strong scenario, **279.6 across 12**, and **349.5 across 15**. Those numbers are assumptions, not expected outcomes. They are used only to detect whether the menu mathematically caps revenue too low.

## Live facts still required

Sledgewire must not be called Arena-ready until all of these are demonstrated on the actual event environment:

1. real SharedNet development Room used by multiple agents, with submitted Room ID and real handoff message IDs;
2. public HTTPS `/arena.md` reachable and understandable by an unrelated agent;
3. organizer-provided Arena Room joined using a real seat;
4. live purse and credit ledger readable;
5. another seat completes request -> payment -> SharedOS -> signed reply;
6. exact completed retry after process restart returns cached delivery with zero re-execution;
7. at least three real external MCP products tested;
8. event-visible SharedOS evidence if entering the SharedOS track;
9. 60-minute no-human autonomous rehearsal;
10. real endpoint p50/p95 latency measured.

No repository-only test can legitimately replace those live gates.
