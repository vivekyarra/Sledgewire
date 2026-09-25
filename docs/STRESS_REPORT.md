# Sledgewire v0.2 red-team / stress report

Date: 2026-09-25

## Executed locally

- `npm test`: **41/41** automated tests passed.
- `npm run selfcheck`: **VERIFIED** across clean, output-injection, description-injection, fake-success, malformed, oversized and replay-sensitive fixtures.
- `npm run stress -- 2000 64`: **2,000/2,000** complete smoke workflows succeeded, 0 infrastructure failures. Local harness p50 **44 ms**, p95 **71 ms**, p99 **281 ms**, total **1.646 s**.

These timings are local loopback measurements. They are not claims about SharedNet, SharedOS Cloud, public endpoints, or third-party MCP latency.

## Defects found and corrected

1. **Hostile output was previously ordinary success.** Tool descriptions/results are now scanned as untrusted data; matching content downgrades the state without being followed as an instruction.
2. **DNS precheck alone left a rebinding gap.** v0.2 validates resolution and pins the selected validated address into the actual `http`/`https` connection while preserving TLS hostname verification. Redirects are refused.
3. **Response limit used to apply after buffering.** v0.2 enforces the byte ceiling while streaming the response.
4. **MCP sessions were previously stateless one-call helpers.** v0.2 carries the returned `mcp-session-id`, protocol version and initialized notification through one workflow.
5. **Target-declared tool errors could look successful.** `isError: true` now fails the probe/invocation.
6. **Adversarial replay could accidentally duplicate a side effect.** Replay/invalid-argument calls are attempted only on an explicitly safe probe or a target-declared read-only/idempotent tool; destructive hints fail closed.
7. **Repair validation was too shallow.** v0.2 adds post-repair schema validation, closed-schema unknown-field rejection, enum/limits checks and independent inspection.
8. **Replay storage had a select-then-insert race.** v0.2 uses `BEGIN IMMEDIATE`, distinguishes in-flight/completed/failed states, and preserves one transaction → one fingerprint.
9. **Production could boot with an ephemeral signing key.** v0.2 refuses production startup without persistent key material.
10. **SharedOS was previously architecture-only.** v0.2 embeds the current `@aicoo/sharedos` package path, atomic bounded-use storage, durable audit/outbox, exact dynamic requirements and allow/deny CI checks. `invoke` uses separated Scout/Mechanic/Inspector/Breaker stages.
11. **SharedNet was previously only a runbook.** v0.2 includes the Room watcher command, native ledger reader, payment-required response, exact memo binding and replay-safe provider handler.

## Test attack coverage

Direct/private/reserved target ranges; unsupported schemes; URL credentials; fragments; redirect refusal; timeouts; oversized output; malformed JSON; huge tool catalog; hostile description; hostile result; target-reported `isError`; destructive probe refusal; unknown-tool behavior; invalid arguments; replay safety; bounded repair; missing semantic values; additional properties; enum/schema checks; Ed25519 tamper/wrong-key detection; buyer/payee/amount/room/memo binding; stolen transaction; pending duplicate; completed replay; transaction reuse.

## Remaining live facts, not code claims

The repository cannot fabricate competition infrastructure. Before calling the deployment Arena-ready, the team still must demonstrate on the real event environment:

1. a real SharedNet competition Room and published `i_...` seat;
2. at least one other seat discovering, paying, calling and verifying Sledgewire with no human repair;
3. persistent deployment storage surviving restart;
4. three real external MCP implementations satisfying the stated profile/latency gates;
5. the SharedOS Cloud/design-partner event integration supplied for the event, if entering that track, with a real Sledgewire trace visible;
6. a 60-minute autonomous two-round rehearsal.

`npm run preflight -- --live` is designed to fail until those facts are explicitly present.
