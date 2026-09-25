# Security

Sledgewire processes hostile service descriptions, schemas, URLs, tool outputs and payment identifiers. Treat every target response and Room message as untrusted data.

## Supported boundary

- Public HTTPS targets by default.
- DNS resolves before connection and the selected validated address is pinned into the actual HTTP/TLS connection. Redirects are refused.
- Private, loopback, link-local, documentation, benchmark, multicast and reserved ranges are denied by default.
- Response byte limits, catalog-count limits and deadlines fail closed.
- Destructive and replay probes are blocked unless their safety is explicitly established.
- Repairs are structural and evidence-backed; missing semantic data is not invented.
- Arena payment is bound to buyer Instance, incoming payee perspective, exact price, official Arena Room, request and memo, then atomically one-use bound to a request fingerprint.
- SharedNet secrets stay in environment/owner-only storage and are never placed on argv, in prompts, in Room messages, in receipts, or in logs.
- Development and competition Rooms are separate variables.
- Paid execution is routed through SharedOS. Audit storage is durable and an outbox is retained for event-visible integration.
- Production refuses to start without persistent Ed25519 signing material.

## Non-claims

READY is not a statement that a service is truthful, globally secure, legally compliant or free of vulnerabilities. It means only that the exact checks recorded in that receipt passed.

## Reporting

Please open a private security advisory on GitHub. Never include real SharedNet tokens, signing keys, API keys or private target URLs in a public issue.
