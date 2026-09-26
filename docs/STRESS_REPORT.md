# Sledgewire v0.3.10 stress report

Date: 2026-09-26

This report separates executed CI evidence from live-event facts. It does not claim or predict an Arena finishing position.

## Current green code evidence

Evidence commit: `a35387a2ba7849fc0b2f81e0424fd87175f0ea1b`

GitHub Actions run: `36239394230`

- Automated tests: **248 / 248 passed**, 0 failed, 0 skipped.
- Hostile/current-protocol selfcheck: **VERIFIED**, signed receipt verification true, profile `sledgewire.selfcheck.v4`.
- MCP stress: **10,000 / 10,000** complete Smoke workflows at concurrency **128**, **0 failures**; p50 **54 ms**, p95 **79 ms**, p99 **162 ms**, total **4.903 s**.
- Arena payment authorization/replay stress: **10,000 claims**, **10,000 cached retries**, **500 wrong-buyer attempts rejected**, with one durable authorization per transaction, total **0.898 s**.
- Duplicate authorization storm: **33,000 authorization attempts** across 1,000 purchases at fanout 16: 1,000 unique claims, 15,000 in-flight duplicate refusals, 16,000 cached replays, 1,000 transaction-reuse refusals and only **1,000 ledger reads**, total **1.199 s**. This measures payment authorization/replay, not service invocation count.
- Handler execution storm (post-release main CI): **33,000 real Arena-handler requests** across 1,000 paid purchases at fanout 16 using file-backed SQLite/WAL: **1,000 actual service executions**, **0 duplicate service executions**, **0 missing executions**, 15,000 in-flight refusals, 16,000 exact signed cached replays, 1,000 transaction-reuse refusals and **1,000 ledger reads**, total **7.759 s** (Actions run `36249277132`).
- SharedOS check: deny true, allow true, exhausted `maxUses` denied, **9 audit events**.
- Static preflight: **READY**.
- Production missing signing key fails closed; persistent key succeeds.
- Production paid-execution bypass flag is explicitly rejected by the HTTP server and tested in CI.
- Locked install (`npm ci`) and production dependency audit at high severity are green.
- The production Docker image builds, boots as non-root, exposes `/health`, and serves a signed modern MCP selfcheck in CI.

These timings are GitHub Actions/local fixture measurements only. They are not SharedNet, public Internet, SharedOS Cloud, or third-party MCP latency claims.

## Red-team flaws found and closed through v0.3.10

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
16. **False-green deployment state.** The public server could be alive while the separate seller daemon was dead. The daemon now writes a 10-second heartbeat into the shared database; public `/ready` fails closed after 45 seconds, and live preflight checks both that readiness signal and the deployed signing-key identity.
17. **Discovery depended on a representative agent remembering to pitch.** The provider daemon now emits one small, machine-readable `sledgewire.available.v1` message with the free proof path, paid ladder and quickstart. The send is idempotent and durably recorded, so restart does not create spam.
18. **Arena economics were not observable from durable state.** `npm run arena:stats` now derives gross verified incoming credits from claimed native payments, paid transaction count, completed-delivery buyer count, service/outcome mix, rejection reasons, Smoke-to-premium conversion, latency and signed/trace evidence coverage without printing buyer identities.
19. **Buyer economics were lossy on failed paid executions.** Paid claims now persist the verified buyer seat before target execution, so gross-credit, unique-buyer and conversion metrics remain accurate even when execution fails after payment. Arena stats v2 separates all paid service mix from completed-delivery service mix.
20. **Schema upgrade could strand an existing competition database.** Startup now performs an online additive migration for the buyer-seat column; exact legacy retries safely backfill buyer identity while preserving cached replay behavior.
21. Earlier hardening remains active: explicit active-probe safety, destructive authorization, exact-target SharedOS grants, unknown-outcome no-retry, poison-message dead-letter, DNS/IP pinning, expanded SSRF blocking, watch-mode single-message delivery, production paid-bypass refusal and restart-safe SQLite replay.
22. **False live-readiness proof.** `--live` previously trusted a manual external-call flag and did not actually negotiate the deployed MCP. It now verifies public health/readiness, modern MCP negotiation, signed selfcheck, signed paid routing, seller identity/payee, signed second-seat rehearsal evidence and restart evidence bound to the current daemon boot.
23. **Impossible Arena launch order.** The runbook previously called live preflight before starting the daemon even though readiness requires its heartbeat. The order is now public server -> daemon -> paid rehearsal -> restart replay -> final live gate.
24. **Local-process heartbeat could mask SharedNet failure.** Arena readiness now refreshes only after a successful SharedNet presence heartbeat plus access to the configured Arena Room, then ages out if those checks stop succeeding.
25. **Runtime numeric configuration could fail open through `NaN`.** HTTP concurrency, daemon concurrency, retry ceilings, stats interval, port and persisted cursor values now use bounded integer parsing; malformed values abort startup.
26. **Ambiguous public origins.** Production public URLs, watch mode, announcements and rehearsal/restart evidence now require canonical credential-free HTTPS origins rather than string-prefix checks.
27. **Dependency graph drift.** A lockfile is checked in; CI and Docker use `npm ci`; CI rejects high-severity production dependency advisories.
28. **Production image path was untested.** CI now builds and boots the real non-root Docker image, checks `/health`, performs a modern MCP selfcheck, and separately proves the production paid-bypass flag cannot start.
29. **Unsigned Room payment quote.** `sledgewire.payment_required.v1` is now Ed25519-signed and buyer-bound; the live rehearsal verifies its signature, buyer, payee, Room, price and memo before transferring credits.
30. **Replay depended on remote ledger retention.** Once payment has been verified and durably bound, exact retries are served from local verified state without requiring the transfer to remain in a bounded remote ledger window; legacy unattributed rows still re-verify before buyer backfill.
31. **Paid failure evidence could become ambiguous.** A paid execution failure is signed and durably cached, and exact retries replay that same failure without charging or executing again.
32. **Non-root secret mount trap.** CI exposed that 0600 key files are unreadable if their 0700 parent directory is owned by another UID. CI and deployment docs now require correct ownership of both directories and files without making secrets world-readable.

## Live facts still required

Repository-only tests cannot replace: a genuine development SharedNet collaboration Room, public deployment reachable by unrelated agents, organizer Arena seat/Room, real purse/ledger transaction from another seat, public and daemon processes sharing the real persistent DB, restart/replay on the live environment, independent `sledgewire.trace` use by another seat, real external MCP services, event-visible SharedOS evidence where applicable, and the 60-minute no-human rehearsal.
