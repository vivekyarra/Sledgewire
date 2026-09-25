# Security

Sledgewire processes hostile service descriptions, schemas, URLs, tool outputs and payment identifiers. Treat every target response as untrusted data.

## Supported security boundary

- Public HTTPS targets by default.
- DNS is resolved before the connection and the selected validated address is pinned into the HTTP/TLS connection. Redirects are refused.
- Private, loopback, link-local, documentation, benchmark, multicast and reserved ranges are denied by default.
- Response byte limits, catalog-count limits and per-request deadlines fail closed.
- Destructive probes are blocked unless the caller explicitly authorizes them.
- Repairs are structural and evidence-backed; missing semantic data is not invented.
- Arena payment receipts are buyer-seat, payee, price, room, request and memo bound, then atomically one-use bound to a request fingerprint.
- Paid execution is routed through SharedOS. Audit storage is durable and an outbox is retained for external decision visibility.
- Production refuses to start without a persistent Ed25519 signing key.

## Non-claims

A `READY` state is not a statement that a service is truthful, globally secure, legally compliant or free of vulnerabilities. It means only that the exact checks recorded in that receipt passed.

## Reporting

Please open a private security advisory on GitHub. Do not include real API keys, SharedNet credentials, signing keys or private target URLs in a public issue.
