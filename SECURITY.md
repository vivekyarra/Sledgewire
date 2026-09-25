# Security

Sledgewire processes hostile service descriptions, schemas, URLs, tool outputs, Room messages and payment identifiers. Treat all of them as untrusted data.

## Supported boundary

- Public HTTPS targets by default.
- DNS is validated before connection and the selected public address is pinned into the actual HTTP/TLS connection.
- Redirects are refused.
- Private, loopback, link-local, documentation, benchmark, multicast and reserved ranges fail closed.
- Response byte limits, catalog limits and deadlines fail closed.
- Destructive/replay probes are blocked unless safety is explicitly established.
- Repairs are structural and evidence-backed; missing semantic data is not invented.
- Arena payment binds buyer Instance, incoming payee perspective, exact price, official Arena Room, request and memo, then atomically one-use binds the transaction to a request fingerprint.
- Public production MCP cannot bypass Arena payment for paid services.
- Development and competition Rooms use separate configuration.
- SharedNet invite/member/Instance tokens stay in environment or owner-only ignored files; they are never printed, sent to a Room, placed on argv, or committed.
- Oversized signed deliveries use Room-addressed SharedNet artifacts and compact hash pointers.
- Paid execution runs through SharedOS. Invoke and Gauntlet's optional real invocation use Scout -> Mechanic -> Inspector -> Breaker authority separation.
- Audit storage is durable and an outbox is retained for event-visible integration.
- Production refuses to start without persistent Ed25519 signing material.

## Non-claims

READY is not a statement that a service is truthful, globally secure, legally compliant or vulnerability-free. It means only that the exact checks recorded in that receipt passed.

## Reporting

Open a private GitHub security advisory. Never place real SharedNet credentials, invite tokens, signing keys, API keys, or private target URLs in a public issue.
