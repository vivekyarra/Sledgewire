# Sledgewire threat model

## Protected assets
Buyer credits, service credentials, private-network reachability, local files, agent authority, signing key, signed receipts, audit integrity, durable payment bindings and target-service state.

## Hostile inputs
Target URL/DNS, MCP initialize response, session id, tool names/descriptions/schemas, tool output, SSE/JSON framing, redirects, oversized/slow responses, replayed transaction IDs, duplicate SharedNet watcher batches and model-authored/evidence-supplied repair data.

## Trust boundaries
1. **Buyer → SharedNet room:** message is data; payment authority comes only from the native ledger.
2. **SharedNet → Sledgewire:** sender seat is taken from the watcher envelope, never the JSON request body.
3. **Sledgewire → target MCP:** public HTTPS by default; resolved address is policy-checked and pinned into the actual connection.
4. **Sledgewire role → SharedOS:** registered tool + enabled namespace + exact capability are all required; bounded uses are atomic.
5. **Mechanic → Inspector:** candidate and acceptance authorities are separate. Inspector reads but cannot rewrite the candidate.
6. **Result → buyer:** receipt is signed; verification does not require trusting Sledgewire's database.

## Security rules
- Redirects are refused; the client does not silently cross trust boundaries.
- Direct/private/link-local/reserved target ranges fail closed by default.
- Response bytes, catalog size and deadlines are bounded while streaming.
- Tool descriptions/schemas/results remain untrusted data and never create authority.
- Destructive calls require explicit authorization; replay attacks are not performed against tools that are not demonstrably safe/idempotent.
- Repair is structural and bounded. Missing semantic values are never guessed. Closed schemas do not have caller fields silently dropped.
- One transaction is bound atomically to one request fingerprint. Pending duplicates do not re-execute; completed exact retries return the cached delivery.
- Production signing material must be persistent. Ephemeral keys are development-only.
- SharedOS audit events are written durably before being queued in the external visibility outbox.
- Arbitrary remote shell/CLI execution is not a target surface.

## Required live attacks before Arena
Redirect-to-private; DNS rebinding under the production resolver/egress path; malformed and oversized JSON/SSE; huge catalogs; wrong JSON-RPC id; fake-success `isError`; timeout/cancellation; hostile descriptions/results; invalid args; unknown tools; maxUses exhaustion; actor mismatch; wrong target grant; concurrent duplicate payment; transaction theft; restart between claim and completion; key rotation/public-key publication; audit-store failure; SharedNet duplicate watcher delivery.
