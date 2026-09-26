# Trial Zero release checklist

## Static code gates — v0.3.8

- [x] CLI and MCP with current 2026-07-28 stateless `server/discover` plus bounded legacy fallback.
- [x] Official `@modelcontextprotocol/client` v2 Streamable HTTP integration test negotiates 2026-07-28 and calls Sledgewire.
- [x] Modern requests enforce protocol/method/name/session rules; Unicode-safe sentinel headers and reachable `x-mcp-header` mirroring are covered.
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
- [x] Exact completed retries are cached; stale uncertain paid executions never blindly re-execute.
- [x] Separate development and Arena Rooms.
- [x] Arena cursor/message persistence, bounded retries, poison-message dead-letter.
- [x] Watch compatibility validates active payee ownership, requires one reply event, and uses artifact fallback for oversized signed deliveries.
- [x] SharedNet page bodies remain bounded while allowing legitimate Room pages above the generic API-response ceiling.
- [x] SharedNet artifact URLs are required to remain HTTPS on the configured SharedNet origin.
- [x] Unused legacy child-process SharedNet adapter removed from production tree.
- [x] SharedNet secrets excluded from git and Docker context.
- [x] SQLite close/reopen replay and two-connection one-use tests green.
- [x] **231 / 231** automated tests green on v0.3.8 Arena-conversion evidence commit.
- [x] **10,000 / 10,000** MCP Smoke workflows at concurrency **128**, 0 failures.
- [x] **10,000** payment claims + 10,000 cached retries + 500 wrong-buyer rejections, 0 duplicate paid executions.
- [x] Duplicate storm: **33,000 authorization attempts**, 1,000 unique claims, 15,000 in-flight duplicates refused, 16,000 cached replays, 1,000 transaction-reuse attempts refused, **1,000 ledger reads**, 0 duplicate paid executions.
- [x] SharedOS deny / allow / maxUses / durable-audit check green.
- [x] Static preflight green; live preflight additionally requires production mode and disabled paid bypass.
- [x] Production MCP Host/authority guard rejects unlisted Host headers.
- [x] Two-process Docker Compose topology shares the same persistent SQLite/WAL volume between public MCP and Arena daemon.
- [x] Public `/ready` fails closed when the Arena daemon heartbeat is missing, stopped or stale; live preflight checks readiness and deployed signing-key identity.
- [x] Provider daemon posts one durable idempotent `sledgewire.available.v1` discovery message and will not repost it after restart.
- [x] Durable `arena:stats` reports verified gross incoming credits, unique completed-delivery buyers, paid transaction count, service/outcome mix, payment rejection reasons, Smoke-to-premium conversion and delivery latency without emitting buyer identities.
- [x] Buyer-side `npm run arena:rehearse` path is implemented and unit-tested for quote -> native transfer -> signed delivery -> trace proof -> exact cached retry.

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
- [ ] Exact completed retry after restart returns cached delivery with zero re-execution.
- [ ] Oversized artifact delivery verified live.
- [ ] At least three real external MCP implementations tested.
- [ ] Event-visible SharedOS evidence confirmed if entering that track.
- [ ] Representative agent follows `docs/ARENA_AGENT_PROMPT.md`.
- [ ] 60-minute no-human rehearsal passes.
- [ ] Real Smoke p95 below 25 seconds and all paid calls below hard deadlines.
