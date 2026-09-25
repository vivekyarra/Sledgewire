# SharedNet build collaboration protocol

Use the required SharedNet room as a real engineering bus, not a transcript decoration.

Roles for the build phase:
- Architect agent: owns protocol, schemas and threat model.
- Builder agent: implements one approved issue at a time.
- Breaker agent: cannot merge; only emits failing reproductions and attack artifacts.
- Verifier agent: reruns tests and signs off on objective gates.

Every handoff message should carry: `artifact_id`, `owner_role`, `input_hash`, `requested_action`, `acceptance_tests`, `result_hash`, and `status`.

The final submission should cite at least three concrete chains: specification→implementation, red-team failure→patch, and patch→independent verification. Preserve room message IDs for each chain.
