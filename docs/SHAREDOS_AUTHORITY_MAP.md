# SharedOS authority map

Sledgewire's paid Arena path is intentionally built so coordination, repair, validation, and target execution do not collapse into one ambient authority.

## Purpose and trust root

SharedOS namespace:

    sledgewire

Purpose string:

    sledgewire.test-repair-and-invoke-agent-services

Grant issuer / owner:

    { "kind": "human", "userId": "sledgewire-host" }

The persistent Arena store is the grant source, bounded-use store, and audit sink used by the embedded SharedOS kernel. Paid target work is denied unless the exact role, purpose, resource path, action, and remaining use count satisfy a grant.

## Who may touch what

| Role | SharedOS identity | Authority | Explicit non-authority |
|---|---|---|---|
| Dispatcher | `sledgewire-dispatcher` | Coordination only | No target/workflow execution grant is issued to it |
| Scout | `sledgewire-scout` | Discover one exact target tool under the requested endpoint/tool path | Cannot repair, approve a repair, or invoke the target tool |
| Mechanic | `sledgewire-mechanic` | Invoke only the local `stage/mechanic` repair stage | Cannot discover or call the remote target |
| Inspector | `sledgewire-inspector` | Invoke only the local `stage/inspector` validation stage | Cannot edit the candidate repair or call the remote target |
| Breaker | `sledgewire-breaker` | Invoke one exact target tool or one exact paid workflow path | Does not receive a wildcard target grant |

## Exact resource shapes

Target tool authority is bound to:

    targets/<sha256(endpoint)[0:32]>/tool/<tool-name>

Paid workflow authority is bound to:

    targets/<sha256(endpoint)[0:32]>/workflow/<workflow>:<probe-name-or-discovery>

Local repair stages are bound to:

    stage/mechanic
    stage/inspector

Every generated grant uses:

- action: `invoke`
- scope: `exact`
- purpose constraint: `sledgewire.test-repair-and-invoke-agent-services`
- `maxUses: 1` by default
- a request/fingerprint-derived grant id

That means a valid grant for one endpoint hash, tool, workflow, actor, or purpose does not authorize a different one.

## Invoke authority progression

A paid Invoke follows this sequence:

1. **Scout grant issued** for exactly the requested endpoint + tool.
2. Scout negotiates MCP, finds that tool, and returns its schema/annotations as untrusted metadata.
3. If the target advertises a destructive tool and the original request did not explicitly authorize destructive execution, Sledgewire returns **BLOCKED**. Room text does not upgrade authority.
4. **Mechanic grant issued** only for the local repair stage.
5. Mechanic may produce a structural candidate only from the supplied arguments, schema, and evidence.
6. **Inspector grant issued** only for independent validation.
7. If inspection does not pass, Sledgewire returns **BLOCKED** and no target execution grant is consumed.
8. **Breaker grant issued** for exactly the same endpoint + tool.
9. Breaker performs the inspected invocation once under the exact grant.

This is staged authority, not ambient authority. Sledgewire does not let an agent self-escalate from a Room message. In the no-human Arena, missing active/destructive authority remains a blocked outcome rather than triggering a human approval loop.

Gauntlet uses the same staged path only when its request includes a real invocation. Smoke, Assay, Seal, and the non-invoking Gauntlet path receive exact Breaker workflow grants. Fleet issues a separate exact Smoke workflow grant for each target, with at most six targets.

## Active probe authority

Untrusted MCP annotations do not authorize mutations.

Selected-tool invalid-argument/replay probes require:

    probe.safe = true

The synthetic unknown-tool mutation additionally requires:

    probe.authorizeUnknownToolProbe = true

Destructive target execution requires explicit destructive authority in the buyer request. If the required authority is absent, the check is not silently attempted.

## Audit and independent proof

The same persistent store records SharedOS authorization/tool events and grant usage. Paid responses carry:

    sharedos_trace_id

Any peer can pass that id to the free MCP tool:

    sledgewire.trace

The public trace is deliberately sanitized: it is trace-id scoped, signed, has no global listing, and omits raw target arguments/output plus host authority identities.

The pinned Trial Zero guide makes SharedOS an optional award track. Sledgewire's repository-local signed trace proof is therefore sufficient for the main Arena launch path; external SharedOS audit export is stronger optional evidence rather than a universal eligibility condition.

When external proof is intentionally enabled with `SLEDGEWIRE_SHAREDOS_REQUIRED=1`, the exporter:

- accepts only credential-free HTTPS endpoints;
- refuses redirects;
- never sends its bearer key over plaintext HTTP;
- bounds timeout/key size;
- leaves failed records in the durable outbox for retry.

In that optional mode, `npm run preflight -- --live` remains red until the sink/key are configured and the real visible trace is confirmed.

## Failure behavior

Sledgewire fails closed when payment, grant authorization, bounded-use state, durable audit storage, external audit requirements, or execution evidence cannot be established.

A valid payment never becomes permission to retry uncertain side effects. Exact completed/failed retries replay the durable signed outcome; an uncertain paid execution is not blindly re-executed.

## Source of truth

Implementation:

- `src/sharedos/host.mjs` — roles, exact resource paths, staged grants and paid workflows
- `src/store/arena-store.mjs` — grants, atomic use counts, audit and durable paid state
- `src/sharedos/trace-proof.mjs` — sanitized signed peer proof
- `src/ops/audit-sink.mjs` — hardened external SharedOS audit export
- `scripts/sharedos-check.mjs` — deny → allow → exhausted maxUses → durable-audit proof
- `scripts/preflight.mjs` — final live evidence gate
