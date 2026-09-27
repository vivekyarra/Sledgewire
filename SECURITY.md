# Security

Sledgewire processes hostile service descriptions, schemas, URLs, tool outputs, Room messages and payment identifiers. Treat all of them as untrusted data.

## Supported boundary

- Public HTTPS targets by default.
- DNS is validated before connection and the selected public address is pinned into the actual HTTP/TLS connection.
- Redirects are refused.
- Private, loopback, link-local, documentation, benchmark, multicast and reserved ranges fail closed.
- Response byte limits, catalog limits and deadlines fail closed.
- Active probes require explicit caller safety attestation; target-supplied readOnly/idempotent annotations do not independently create execution authority.
- Destructive probes and invocations require separate explicit destructive authority.
- Repairs are structural and evidence-backed; missing semantic data is not invented.
- Arena payment requires the organizer-specified native memo `Sledgewire`, strict buyer/payee/amount/Room verification, and an Ed25519-signed pre-payment quote. The quote fingerprint is durably bound to Room + buyer + request id + service + exact input before payment. Outstanding quotes have a 4-hour TTL plus per-buyer/global caps, and terminal paid outcomes reclaim quote state. The transaction remains atomically one-use.
- Public production MCP cannot bypass Arena payment for paid services; startup fails if the bypass flag is enabled in production.
- Development and competition Rooms use separate configuration. Production competition runtime also requires one recorded official Arena Instance/seat and fails closed if the daemon authenticates as a different seat.
- SharedNet invite/member/Instance tokens stay in environment or owner-only ignored files; they are never printed, sent to a Room, placed on argv, or committed. Authenticated seat identity is stable for the token and is cached across transfer scans to reduce remote verification calls.
- SharedNet JSON responses are streamed with hard byte ceilings before parsing; Room messages above 32 KiB are dropped before parsing; malformed transaction ids are rejected before verification state; ledger lookup bursts are coalesced/cached; bogus nonexistent-payment storms hit bounded per-buyer/global miss controls while reserving verification slots for fresh buyers; oversized signed deliveries use Room-addressed artifacts and compact hash pointers.
- Every paid target workflow runs under an exact-target SharedOS grant. The dispatcher has no direct target-service authority. Invoke and Gauntlet's optional real invocation use Scout -> Mechanic -> Inspector -> Breaker separation.
- Audit storage is durable and an outbox is retained for event-visible integration.
- Public audit proof is trace-id scoped, indexed and sanitized: it omits host metadata, authority/owner addresses, raw tool arguments and outputs; it never lists traces globally.
- Exact completed/failed paid outcomes are replayed from verified durable state without requiring the original transfer to remain inside the provider's bounded remote ledger-history scan. Payment claim and execution start are separate durable boundaries: only stale claims proven never to have crossed execution start may recover automatically; once execution may have started, retries fail closed as unknown/no-reexecute. Pre-v0.3.14 inflight rows migrate conservatively as execution-may-have-started.
- A post-payment execution exception produces a signed, cached failure receipt. The same paid request returns the identical failure proof on retry.
- Poison Room messages have bounded retries and a terminal dead-letter state so one malformed delivery cannot freeze the autonomous cursor. The daemon schedules at most one in-flight message per sender while preserving global concurrency, and prunes terminal message-dedupe state only behind the durable cursor.
- Watch compatibility accepts one reply event at a time, validates the configured payee against the authenticated SharedNet identity, and uses artifact fallback for oversized signed responses.
- No production SharedNet path shells out through `npx`; the unused legacy child-process adapter was removed.
- Receipt canonicalization rejects excessive depth, node counts, cycles and oversized canonical bodies.
- Production refuses to start without persistent Ed25519 signing material. Production service origins must be credential-free HTTPS origins and numeric runtime limits fail closed on malformed values.
- Public readiness freshness is refreshed only after successful SharedNet presence and configured Arena Room access, not by a local timer alone.
- Public selfcheck uses a short single-flight cache to absorb judge bursts; production HTTP caps sockets/active requests, rejects oversized declared bodies from headers, drains/discards rejected payloads, and bounds total-request, header, idle-socket and keepalive lifetimes.
- Arena-2 budget state is fail-closed local control state: writes are atomic, corrupt/symlink/non-file state is rejected rather than silently reinitialized, duplicate offer IDs cannot encode conflicting purchases, and the default planner excludes Sledgewire itself.

## Non-claims

READY is not a statement that a service is truthful, globally secure, legally compliant or vulnerability-free. It means only that the exact checks recorded in that receipt passed.

## Reporting

Open a private GitHub security advisory. Never place real SharedNet credentials, invite tokens, signing keys, API keys, or private target URLs in a public issue.
