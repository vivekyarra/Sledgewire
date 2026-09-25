# Sledgewire v0.3 stress report

Date: 2026-09-25

This file distinguishes executed tests from live event facts. Numbers are updated only from real CI or live rehearsals.

## Security families covered by automated tests

- hostile tool output and hostile descriptions;
- fake-success envelopes;
- malformed JSON;
- streamed response byte limits;
- oversized catalog;
- timeout;
- redirect refusal;
- private/reserved target policy;
- destructive probe refusal;
- unknown-tool acceptance;
- schema-forbidden extra-field acceptance;
- divergent idempotent replay;
- bounded evidence repair and independent reproduction;
- receipt signature, tamper and wrong-key failure;
- payment buyer/payee/amount/room/memo binding;
- completed retry caching;
- in-flight duplicate refusal;
- transaction reuse refusal;
- failed-request no-silent-reexecution;
- atomic SharedOS maxUses consumption;
- SharedNet V1 identifier, message, ledger and caller-perspective normalization;
- Room cursor/message persistence;
- free quote routing;
- public selfcheck;
- Gauntlet dossier;
- one-link Arena card.

## Load gates

CI runs:

    npm run stress -- 2000 64
    npm run stress:arena -- 1000

The first stresses complete local MCP smoke workflows. The second stresses payment claims, cached retries and wrong-buyer rejection.

Any local timing is only a local harness measurement, not a claim about public-network, SharedNet or third-party MCP latency.

## SharedOS gate

CI runs npm run sharedos:check and requires:

- no grant -> denied;
- matching grant -> succeeded;
- exhausted maxUses -> denied;
- audit records persisted.

## Economy gate

npm run economy prints deterministic sensitivity scenarios across field sizes. It is not a forecast and does not claim a finishing position. Its purpose is to catch a service ladder whose arithmetic makes substantial gross credits implausible.

## Live facts still required

Before Arena-ready status:

1. actual development SharedNet collaboration Room recorded for submission;
2. public HTTPS one-link reachable by an unrelated agent;
3. real organizer Arena Room joined;
4. other-seat request/payment/delivery/receipt verification;
5. restart survival and cached retry;
6. three external MCP products tested;
7. event-visible SharedOS trace if entering that track;
8. 60-minute autonomous rehearsal;
9. real endpoint latency measurements.
