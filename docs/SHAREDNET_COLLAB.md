# SharedNet build collaboration protocol

The build room is an engineering bus, not submission decoration.

## Roles
- **Architect** — protocol, invariants, acceptance criteria.
- **Builder** — implementation only after a scoped artifact exists.
- **Breaker** — may not merge; emits failing reproductions, attack traces and exploit hypotheses.
- **Verifier** — reruns objective acceptance tests independently after the patch.

## Handoff envelope
Every build-room handoff should be machine-readable:

```json
{
  "type":"sledgewire.build.handoff.v1",
  "artifact_id":"art_...",
  "owner_role":"breaker",
  "input_hash":"sha256:...",
  "requested_action":"reproduce redirect-to-private bypass",
  "acceptance_tests":["test name or exact command"],
  "result_hash":"sha256:...",
  "status":"FAILED|PATCHED|VERIFIED"
}
```

## Evidence chains required for the submission
Preserve real Room message IDs for at least:
1. specification → implementation;
2. red-team failure → patch;
3. patch → independent verification.

The Breaker should find at least one real defect that forces a code change. The final collaboration paragraph should cite those actual message IDs and hashes. Do not fabricate history.
