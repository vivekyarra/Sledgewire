# Sledgewire v0.3.7 stress report

Date: 2026-09-25

This report separates executed CI evidence from live-event facts. It does not claim or predict an Arena finishing position.

## Current green code evidence

Evidence commit: `927ad48173e189abc1c6e743935c405eb82c88bd`

GitHub Actions run: `36176411707`

- Automated tests: **220 / 220 passed**, 0 failed, 0 skipped.
- Hostile/current-protocol selfcheck: **VERIFIED**, signed receipt verification true, profile `sledgewire.selfcheck.v4`.
- MCP stress: **10,000 / 10,000** complete Smoke workflows at concurrency **128**, **0 failures**; p50 **144 ms**, p95 **157 ms**, p99 **262 ms**, total **11.893 s**.
- Arena ledger/replay stress: **10,000 claims**, **10,000 cached retries**, **500 wrong-buyer attempts rejected**, **0 duplicate paid executions**, total **1.476 s**.
- Duplicate storm: **33,000 authorization attempts** across 1,000 purchases at fanout 16: 1,000 unique claims, 15,000 in-flight duplicate refusals, 16,000 cached replays, 1,000 transaction-reuse refusals, only **1,000 ledger reads**, **0 duplicate paid executions**, total **1.447 s**.
- SharedOS check: deny true, allow true, exhausted `maxUses` denied, **9 audit events**.
- Static preflight: **READY**.
- Production missing signing key fails closed; persistent key succeeds.
- Production paid-execution bypass flag is explicitly rejected by the HTTP server and tested in CI.

These timings are GitHub Actions/local fixture measurements only. They are not SharedNet, public Internet, SharedOS Cloud, or third-party MCP latency claims.

## Red-team flaws found and closed through v0.3.7

1. **Cross-buyer request-label collision.** Buyer-controlled `request_id` was previously a global store/grant identity. Durable state is now scoped by Room + buyer + request id, and SharedOS grant ids derive from the full request fingerprint.
2. **Pay-for-invalid-work trap.** Paid input used to be fully rejected only after payment. Service-specific endpoint/probe/invoke/fleet shapes and resource budgets are now validated before PAYMENT_REQUIRED or ledger lookup.
3. **Modern MCP wire incompleteness.** Official MCP v2 client testing exposed missing sender-side `resultType` and cache hints. Modern discovery/list/call envelopes and required protocol/method/name headers are now emitted/validated.
4. **Missing MCP parameter headers.** Reachable primitive `x-mcp-header` declarations are scanned, duplicate/unreachable declarations fail closed, and tool arguments are mirrored through sentinel-safe `Mcp-Param-*` headers.
5. **HTTP content-type smuggling and body growth.** JSON media type is parsed exactly; target request/response and public request bytes are bounded incrementally.
6. **Ledger payee ambiguity.** A `direction=received` string is no longer accepted as proof. Exact addressed payee evidence is preferred; principal-perspective fallback is narrowly scoped.
7. **Request-label isolation omitted Room context.** Storage keys now include Arena Room as well as buyer and request id.
8. **Ledger retry amplification.** Duplicate payment waves once caused one ledger query per authorization attempt. Per-transaction in-flight coalescing plus bounded positive/negative caching reduced the 33,000-attempt stress run to 1,000 ledger reads.
9. **Receipt canonicalization exhaustion.** Deep/cyclic payloads could drive recursive signing/verification failure. Canonicalization now has explicit depth, node, cycle and byte ceilings.
10. **SharedNet URL/proof edge cases.** Non-HTTP localhost base schemes, direction-only payee proof, over-tight Room page limits and off-origin artifact URLs are rejected or corrected.
11. **External authority evidence gap.** A paid receipt previously carried a trace id without a peer-callable proof surface. Free `sledgewire.trace` now returns a signed, trace-id-scoped, sanitized SharedOS event packet while omitting metadata, authority/owner identities and raw target arguments/outputs.
12. **Brittle preflight price ordering.** Catalog equality depended on JSON key insertion order. Exact price-map comparison is now order-independent and separately tested.
13. **Public MCP Host-header gap.** Production MCP now restricts Host/authority to the configured public origin plus explicit trusted proxy authorities, complementing the existing Origin guard.
14. **Live proof was manual.** A buyer-side `arena:rehearse` flow now automates a real second-seat 3-credit Smoke purchase, signed delivery verification, independent `sledgewire.trace` verification and exact cached retry; it writes a redacted mode-0600 evidence packet.
15. **Split-process deployment risk.** A checked-in two-process Docker Compose topology forces the public server and Arena daemon onto the same persistent SQLite/WAL volume and shared signing key.
16. Earlier hardening remains active: explicit active-probe safety, destructive authorization, exact-target SharedOS grants, unknown-outcome no-retry, poison-message dead-letter, DNS/IP pinning, expanded SSRF blocking, watch-mode single-message delivery, production paid-bypass refusal and restart-safe SQLite replay.

## Live facts still required

Repository-only tests cannot replace: a genuine development SharedNet collaboration Room, public deployment reachable by unrelated agents, organizer Arena seat/Room, real purse/ledger transaction from another seat, public and daemon processes sharing the real persistent DB, restart/replay on the live environment, independent `sledgewire.trace` use by another seat, real external MCP services, event-visible SharedOS evidence where applicable, and the 60-minute no-human rehearsal.
