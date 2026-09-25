# SharedOS integration

Sledgewire uses the published `@aicoo/sharedos` `1.0.0-preview` package for paid Arena execution.

Canonical role identities:

- `sledgewire-dispatcher`
- `sledgewire-scout`
- `sledgewire-breaker`
- `sledgewire-mechanic`
- `sledgewire-inspector`

Purpose: `sledgewire.test-repair-and-invoke-agent-services`.

`src/sharedos/host.mjs` creates the kernel. `src/store/arena-store.mjs` is both the trusted grant source and the atomic bounded-use store, and persists audit events plus an external-audit outbox. For `invoke`, Scout gets exact target discovery authority, Mechanic gets only local candidate-repair authority, Inspector gets only repair-validation authority, and Breaker alone gets exact target/tool invocation authority.

Run `npm run sharedos:check` after dependencies are installed. It proves: no grant → deny, matching bounded grant → allow, exhausted `maxUses` → deny, and audit records are durable.
