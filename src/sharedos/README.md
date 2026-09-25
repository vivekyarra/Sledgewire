# SharedOS integration

The paid Arena path embeds `@aicoo/sharedos@1.0.0-preview` and persists grants, bounded-use counters, audit events and an external-visibility outbox in SQLite.

Canonical identities:
- `sledgewire-dispatcher`
- `sledgewire-scout`
- `sledgewire-breaker`
- `sledgewire-mechanic`
- `sledgewire-inspector`

Purpose: `sledgewire.test-repair-and-invoke-agent-services`

`sharedosRunService` gates every paid service through exact product authority. `sharedosInvokeWorkflow` additionally enforces four distinct stages: Scout discovers the exact target; Mechanic writes one candidate; Inspector reads/validates it; Breaker alone receives the exact target/tool invocation grant.

Run `npm run sharedos:check` after installing dependencies. The check requires one allowed decision, one denied cross-role attempt and durable audit records for both.
