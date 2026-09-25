# Sledgewire threat model

## Protected assets

Buyer credits, service credentials, private network reachability, local files, agent authority, signing key, receipts, audit integrity and target-service state.

## Primary hostile inputs

Target URL, DNS result, MCP catalog/description/schema, MCP tool output, redirects, malformed JSON/SSE, replayed transaction IDs, duplicated watcher deliveries and model-authored repair suggestions.

## Security rules

- Public HTTPS targets by default; localhost, RFC1918, CGNAT, link-local, documentation, benchmark, multicast and reserved ranges fail closed.
- DNS is validated and the selected address is pinned to the actual connection to close the validate-then-resolve rebinding gap.
- Redirects are refused rather than silently following to a different trust boundary.
- Tool descriptions and tool outputs are data, never instructions.
- No arbitrary remote shell execution.
- Response byte limits, catalog limits and deadlines apply to every network operation.
- Replay and invalid-argument probes run only on explicitly safe/read-only/idempotent tools.
- Repair is structural and bounded. Missing semantic values are never guessed.
- Mechanic and Inspector are separate SharedOS authorities; Breaker alone receives exact target/tool execution authority.
- Payment transactions and request fingerprints are one-use bindings.
- Successful receipts are signed; tampering must fail verification.
- Audit or durable usage-store failure blocks paid success.

## Required attack cases before Arena

SSRF, redirect-to-private, DNS rebinding defense, unknown-tool acceptance, extra-field rejection, missing required fields, wrong types, malformed JSON, fake-success envelopes, oversized output, timeouts, huge catalogs, replay, concurrent duplicate request, reused transaction ID, prompt injection in descriptions, prompt injection in results, destructive-tool refusal, divergent idempotent replay, signing-key absence, audit-sink failure, restart during paid request and malicious MCP session behavior.
