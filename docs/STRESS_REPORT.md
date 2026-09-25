# Sledgewire v0.3.4 stress report

Date: 2026-09-25

This report separates executed CI evidence from live-event facts. It does not claim or predict an Arena finishing position.

## Current green branch evidence

Tested commit: `bd41e459980f22c60c1b2a19930c46ec99b31bee`

GitHub Actions run: `36168416265`

- Automated tests: **171 / 171 passed**, 0 failed, 0 skipped.
- Hostile/current-protocol selfcheck: **VERIFIED**, signed receipt verification true, profile `sledgewire.selfcheck.v4`.
- MCP stress: **5,000 / 5,000** complete Smoke workflows at concurrency **96**, **0 failures**; p50 **114 ms**, p95 **159 ms**, p99 **451 ms**, total **6.585 s**.
- Arena ledger/replay stress: **5,000 claims**, **5,000 cached retries**, **500 wrong-buyer attempts rejected**, **0 duplicate paid executions**, total **672 ms**.
- Duplicate storm: **12,500 authorization attempts** across 500 purchases at fanout 12: 500 unique claims, 5,500 in-flight duplicate refusals, 6,000 cached replays, 500 transaction-reuse refusals, **0 duplicate paid executions**, total **541 ms**.
- SharedOS check: deny true, allow true, exhausted `maxUses` denied, **9 audit events**.
- Static preflight: **READY**.
- Production missing signing key fails closed; persistent key succeeds.
- Production paid-execution bypass flag is explicitly rejected by the HTTP server and tested in CI.

These timings are GitHub Actions/local fixture measurements only. They are not SharedNet, public Internet, SharedOS Cloud, or third-party MCP latency claims.

## Red-team flaws found and closed in v0.3.4

1. Target readOnly/idempotent annotations could previously contribute too much authority to active probes. Active probes now require explicit caller safety attestation; destructive execution needs a separate explicit authority bit.
2. Invoke could return READY despite hostile tool metadata when the runtime output itself was clean. Suspicious metadata now downgrades the result.
3. Paid non-Invoke workflows previously ran behind broad dispatcher wrapper grants. Smoke, Assay, Seal, Fleet targets and Gauntlet now receive exact-target SharedOS workflow grants; dispatcher has no direct target-service authority.
4. A crash after an external side effect but before durable completion created retry ambiguity. Stale inflight paid requests now become `execution_outcome_unknown_no_retry`.
5. Repeatedly failing Room messages could permanently hold the cursor. Retries are bounded and poison messages become terminal dead letters.
6. SharedNet response bodies were parsed through unbounded `response.text()`. JSON responses are now streamed under a byte ceiling before parsing.
7. IPv4-mapped IPv6, NAT64, 6to4 and additional reserved IPv6 paths are blocked.
8. Modern MCP discovery fallback could hide non-legacy failures. Only explicit legacy evidence triggers fallback; timeouts/internal errors remain failures.
9. Modern protocol validates version/method/name headers and rejects legacy session headers.
10. Receipt verification now fails closed on malformed public keys and malformed signature encodings.
11. Schema validation gained safe support for nullable type unions, standard harmless schema metadata and schema-valued `additionalProperties`.
12. SharedNet request IDs, wait cursors, page limits, base URL and artifact responses are validated.
13. Production HTTP can no longer enable direct paid execution through an environment override.
14. SQLite recovery is exercised across close/reopen and independent connections.

## Live facts still required

Repository-only tests cannot replace: a genuine development SharedNet collaboration Room, public deployment reachable by unrelated agents, organizer Arena seat/Room, real purse/ledger transaction from another seat, restart/replay on the live environment, real external MCP services, event-visible SharedOS evidence where applicable, and the no-human live rehearsal.
