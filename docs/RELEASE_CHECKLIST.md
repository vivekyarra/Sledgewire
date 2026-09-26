# Trial Zero release checklist

## Static code gates — v0.3.10

- [x] CLI and MCP with current 2026-07-28 stateless `server/discover` plus bounded legacy fallback.
- [x] Official `@modelcontextprotocol/client` v2 Streamable HTTP integration test negotiates 2026-07-28 and calls Sledgewire.
- [x] Modern requests enforce required per-request `clientCapabilities` plus protocol/method/name/session rules; malformed 2026-07-28 envelopes fail with HTTP 400 / JSON-RPC `-32602`. Unicode-safe sentinel headers and reachable `x-mcp-header` mirroring are covered.
- [x] Modern responses emit required `resultType`; cacheable discovery/catalog responses emit `ttlMs` and `cacheScope`.
- [x] Modern downgrade refuses to hide timeout/internal errors as legacy compatibility.
- [x] Exact JSON media-type checks, target request ceilings, response content-length/stream ceilings and deadlines fail closed.
- [x] One-link `/arena.md`, machine-readable `/arena.json`, free selfcheck, quote, trace and verify.
- [x] Paid ladder 3 / 8 / 12 / 20 / 25 / 35.
- [x] Structurally invalid paid inputs are rejected before payment/ledger lookup.
- [x] Production paid-MCP bypass is impossible; CI explicitly tests startup rejection.
- [x] Persistent signing key required in production.
- [x] Receipt canonicalization is bounded by depth, node count, cycles and byte ceiling.
- [x] DNS validation, connection-time IP pinning, redirect refusal and expanded IPv4/IPv6 private/reserved/NAT64/6to4 blocking.
- [x] Active probes require explicit caller safety attestation; destructive calls require explicit destructive authority.
- [x] Evidence-bounded repair, independent inspection and suspicious-metadata downgrade.
- [x] Every paid network workflow uses an exact-target SharedOS grant; dispatcher has no direct target authority.
- [x] Invoke/Gauntlet real execution preserves Scout -> Mechanic -> Inspector -> Breaker authority separation.
- [x] SharedOS bounded-use state and durable audit/outbox.
- [x] Paid receipts carry a SharedOS trace id; free `sledgewire.trace` returns a sanitized signed trace proof with no global listing.
- [x] Native SharedNet credit verification binds buyer, exact/fallback-safe payee evidence, integer amount, Arena Room, memo and one-use transaction.
- [x] Request storage/grant identity is scoped by Room + buyer + request fingerprint, preventing cross-buyer request-label collisions.
- [x] Concurrent duplicate ledger checks are coalesced; positive/negative lookups are bounded in-memory cached.
- [x] Exact completed retries are cached from the previously verified durable payment binding without requiring the transfer to remain in remote ledger history; legacy unattributed rows re-verify before buyer backfill; stale uncertain paid executions never blindly re-execute.
- [x] Separate development and Arena Rooms.
- [x] Arena cursor/message persistence, bounded retries, poison-message dead-letter.
- [x] Watch compatibility validates active payee ownership, requires one reply event, and uses artifact fallback for oversized signed deliveries.
- [x] SharedNet page bodies remain bounded while allowing legitimate Room pages above the generic API-response ceiling.
- [x] SharedNet artifact URLs are required to remain HTTPS on the configured SharedNet origin.
- [x] Unused legacy child-process SharedNet adapter removed from production tree.
- [x] SharedNet secrets excluded from git and Docker context.
- [x] SQLite close/reopen replay and two-connection one-use tests green.
- [x] **248 / 248** automated tests green on v0.3.10 main merge `a35387a2ba7849fc0b2f81e0424fd87175f0ea1b` (Actions run `36239394230`).
- [x] **10,000 / 10,000** MCP Smoke workflows at concurrency **128**, 0 failures.
- [x] **10,000** payment claims + 10,000 cached retries + 500 wrong-buyer rejections with one durable authorization per transaction.
- [x] Duplicate authorization storm: **33,000 authorization attempts**, 1,000 unique claims, 15,000 in-flight duplicates refused, 16,000 cached replays, 1,000 transaction-reuse attempts refused and **1,000 ledger reads**. Service invocation count is covered separately at handler level.
- [x] SharedOS deny / allow / maxUses / durable-audit check green.
- [x] Static preflight green; hardened live preflight additionally requires production mode, disabled paid bypass, public modern MCP negotiation, signed selfcheck/payment route, authenticated seller identity/payee, cryptographically validated second-seat rehearsal evidence, and restart-replay evidence matching the current daemon boot.
- [x] Production MCP Host/authority guard rejects unlisted Host headers.
- [x] Two-process Docker Compose topology shares the same persistent SQLite/WAL volume between public MCP and Arena daemon.
- [x] Public `/ready` fails closed when the Arena daemon readiness pulse is missing, stopped or stale; after startup the pulse refreshes only after successful SharedNet presence plus configured Arena Room access; live preflight checks readiness and deployed signing-key identity.
- [x] Provider daemon posts one durable idempotent `sledgewire.available.v1` discovery message and will not repost it after restart.
- [x] Durable `arena:stats` v2 reports verified gross incoming credits, all verified paid buyers, completed-delivery buyers, paid transaction count, paid/delivered service mix, rejection reasons, Smoke-to-premium conversion and latency without emitting buyer identities.
- [x] Paid claims persist buyer seat before execution; pre-v0.3.9 Arena databases migrate online and exact legacy retries backfill buyer identity without changing replay semantics.
- [x] Buyer-side `npm run arena:rehearse` path verifies a buyer-bound **signed** payment quote -> native transfer -> signed delivery -> trace proof -> exact cached retry.
- [x] Daemon readiness exposes a non-secret per-process `boot_id`; `npm run arena:replay-after-restart` refuses same-boot runs and verifies the original receipt + trace survive a real daemon restart without a second payment.
- [x] `package-lock.json` pins the full npm graph; CI/Docker use `npm ci`; CI rejects high-severity production dependency advisories.
- [x] CI builds and boots the real non-root production Docker image, verifies `/health`, and performs a signed modern MCP selfcheck.
- [x] Production/runtime origin and numeric configuration fail closed on credentialed/pathful public bases, NaN/fractional/out-of-range concurrency/timer/cursor settings, and malformed persisted cursors.
- [x] Room `PAYMENT_REQUIRED` responses are Ed25519-signed and buyer-bound.
- [x] Paid execution failures are signed, durably cached and replayed exactly without duplicate execution or another ledger read.

## Submission P0

- [ ] Actual SharedNet development Room used by multiple build agents.
- [ ] `SHAREDNET_BUILD_ROOM_ID` recorded and real collaboration message IDs preserved.
- [ ] Participant/team name and contact final.
- [ ] Public HTTPS `/arena.md` product link final and accessible to an unrelated agent.
- [ ] Public MCP and Arena daemon use the same persistent `SLEDGEWIRE_DB`.
- [ ] `npm run preflight -- --submission` green.
- [ ] Submit only once.

## Arena P0

- [ ] Exact green competition commit frozen.
- [ ] Organizer Arena Room configured separately from build Room.
- [ ] Competition seat joined; invite token removed afterward.
- [ ] Payee verified against current SharedNet identity; purse/ledger readable.
- [ ] Run `npm run arena:rehearse` with a real second seat; preserve `.sledgewire/live-rehearsal.json` as evidence.
- [ ] Another seat completes request -> payment -> SharedOS -> signed reply.
- [ ] Another seat independently calls `sledgewire.trace` on that paid receipt and verifies the returned proof.
- [ ] After a real daemon restart, `npm run arena:replay-after-restart` verifies changed boot id + identical cached delivery + persisted trace with zero second payment.
- [ ] Oversized artifact delivery verified live.
- [ ] At least three real external MCP implementations tested.
- [ ] Event-visible SharedOS evidence confirmed if entering that track.
- [ ] Representative agent follows `docs/ARENA_AGENT_PROMPT.md`.
- [ ] 60-minute no-human rehearsal passes.
- [ ] Real Smoke p95 below 25 seconds and all paid calls below hard deadlines.
- [ ] Final `npm run preflight -- --live` is green against the exact deployment and current daemon boot.
