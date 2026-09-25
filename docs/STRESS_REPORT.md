# Sledgewire v0.3.3 stress report

Date: 2026-09-25

This report separates executed evidence from live-event facts. It does not claim an Arena finishing position.

## Current green branch evidence

Tested commit: `0d2a77e6b80352a28884d7cef4ee9431405e6c96`

GitHub Actions run: `36161204939`

- Automated tests: **128 / 128 passed**, 0 failed, 0 skipped.
- Hostile-fixture selfcheck: **VERIFIED**; signed receipt verification true.
- MCP load harness: **2,000 / 2,000** complete Smoke workflows at concurrency **64**, **0 failures**.
- MCP load timing on the v0.3.3 branch CI runner: p50 **72 ms**, p95 **117 ms**, p99 **384 ms**, total **2.709 s**.
- Arena payment/replay harness: **1,000 claims**, **1,000 cached retries**, **500 wrong-buyer attempts rejected**, **0 duplicate paid executions**, total **146 ms**.
- SharedOS integration: no grant denied; matching grant allowed; exhausted `maxUses` denied; **9 audit events** persisted.
- Static preflight: **READY**.
- Production signing policy: missing persistent key fails closed; valid persistent key succeeds.

These latency measurements are local CI harness measurements only. They are not claims about SharedNet, SharedOS Cloud, public-network, or third-party MCP latency.

## MCP 2026-07-28 compatibility

Sledgewire now probes `server/discover` using the current **2026-07-28 stateless MCP era**, sends required per-request `_meta` and `MCP-Protocol-Version`, rejects header/body version mismatches, omits protocol session IDs in the modern era, and falls back to the legacy initialize/initialized handshake for 2025-era servers. The public HTTP server validates `Origin` when present.

## Security and organizer-protocol coverage

The automated suite covers:

- hostile tool output and hostile descriptions;
- fake-success envelopes;
- malformed JSON and Streamable HTTP/SSE behavior;
- streamed response-byte limits;
- oversized tool catalog;
- deadlines and redirect refusal;
- public/private/reserved target policy;
- destructive probe refusal;
- unknown-tool acceptance;
- schema-forbidden extra-field acceptance;
- divergent idempotent replay;
- evidence-bounded structural repair and independent reproduction;
- receipt signature, tamper and wrong-key failure;
- payment buyer/payee/amount/Arena-room/memo binding;
- exact completed retry caching;
- in-flight duplicate refusal;
- transaction reuse refusal;
- failed-request no-silent-reexecution;
- atomic SharedOS `maxUses` consumption;
- current long SharedNet typed IDs plus legacy short IDs;
- current guest invite join with `rit_` authorization, runtime metadata, and owner-only returned seat token;
- compatible `sni_` / `rmt_` seat-token handling;
- current SharedNet wait semantics using only documented `after` + `timeout`;
- caller-perspective credit-ledger normalization;
- payee ownership against current Principal/Agent/Instance identity;
- Room cursor/message persistence and retry ownership;
- deterministic idempotency keys for replies;
- public paid-MCP bypass prevention: production direct calls return signed `PAYMENT_REQUIRED` routing rather than executing paid work for free;
- SharedNet 32 KiB Room-message protection;
- Room-addressed artifact fallback for large signed deliveries, bounded by the 4 MiB artifact ceiling;
- free quote routing;
- public selfcheck;
- Gauntlet seller dossier;
- Gauntlet optional invocation through Scout -> Mechanic -> Inspector -> Breaker;
- one-link Arena quickstart.

## Organizer/current-protocol defects found and closed

1. **Development/Arena Room conflation.** Separate `SHAREDNET_BUILD_ROOM_ID` and `SHAREDNET_ARENA_ROOM_ID` configuration now prevents accidental reuse.
2. **Guest invite mismatch.** Added `npm run arena:join` for the current `rit_` invite flow. It stores the returned seat token owner-only and never prints it.
3. **Undocumented wait parameter.** Removed `limit` from `/wait`; tests assert the current `after` + `timeout` contract.
4. **Paid public MCP bypass.** Production public MCP no longer executes paid services directly; it returns a signed payment route into the official Arena.
5. **Large signed delivery failure.** Oversized responses become SharedNet Room artifacts and the Room receives a compact SHA-256 pointer.
6. **Autonomous restart ambiguity.** Room messages now use in-flight/completed/failed ownership plus persistent cursor state and retry-safe reply idempotency.
7. **Wrong payee configuration.** Live preflight requires the configured payee to belong to the authenticated SharedNet identity.
8. **Gauntlet privilege widening.** Its optional real invocation is routed through the same separated SharedOS Scout/Mechanic/Inspector/Breaker stages as Invoke.
9. **Credential leakage surface.** `.sharednet/`, `.env*`, signing keys and local DB state are excluded from git and Docker context.

## Economy sensitivity

`npm run economy` is deterministic arithmetic, not a forecast, probability, or ranking claim. Seal and Gauntlet are modeled as mutually exclusive seller-premium choices because Gauntlet already contains conformance evidence.

The model exists to reject pricing that mathematically caps revenue too low. Actual Arena 2 placement depends only on valid credits actually earned.

## Live facts still required

Sledgewire must not be called Arena-ready until all are demonstrated on the real event environment:

1. real SharedNet development Room used by multiple build agents, with submitted Room ID and concrete handoff message IDs;
2. public HTTPS `/arena.md` reachable and understandable by an unrelated agent;
3. organizer-provided Arena Room joined with the real competition seat;
4. native purse and credit ledger readable;
5. another seat completes request -> payment -> SharedOS -> signed delivery;
6. exact completed retry after process restart returns cached delivery with zero re-execution;
7. oversized artifact delivery verified live;
8. at least three real external MCP implementations tested;
9. event-visible SharedOS evidence if entering the SharedOS track;
10. 60-minute no-human autonomous rehearsal;
11. real endpoint p50/p95 latency measurements.

No repository-only test legitimately replaces those live gates.
