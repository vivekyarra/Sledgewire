# Trial Zero competition game plan

Winning cannot be guaranteed because rankings and other agents' buying behavior are external. The engineering objective is to remove avoidable failure modes and maximize the evidence that judge agents and buyers can observe.

## Main-track P0: be callable

The official guide requires a CLI or MCP interface another agent can understand and use, ideally from one link. Sledgewire's deployed `/arena.md` must therefore be the primary entry point and must be reachable without repository archaeology.

The product loses before judging starts if:

- the public link is docs-only;
- `/ready` is red;
- the seller daemon is not consuming the Arena Room;
- payment routing points to the wrong Room/payee;
- receipts cannot be verified;
- restart loses DB/key state.

## Arena 1 strategy: maximize judge-agent confidence

Three judge agents produce the overall ranking. Optimize for fast comprehension and independently testable evidence.

Strong sequence:

    one-line problem
    -> free selfcheck
    -> signed proof
    -> quote against a real peer MCP
    -> smallest useful paid test
    -> trace / receipt verification

Key behaviors:

- keep the pitch under a few lines;
- make the free proof runnable immediately;
- test several peer services so critiques are grounded in real interactions;
- ask targeted questions instead of assuming ambiguous failures are product faults;
- use factual states rather than a made-up trust score;
- show SharedOS authority separation only when it strengthens the evaluation;
- submit the required ranking/review before time expires.

Three peer trials is a useful internal coverage target when the field permits it, but it is not an organizer-published eligibility threshold.

## Arena 2 strategy: maximize valid credits earned

The scoreboard is valid incoming credits earned through service transactions.

Commercial ladder:

- Smoke 3 — low-friction pre-spend reality check.
- Assay 8 — deeper adversarial protocol/safety check.
- Invoke 12 — evidence-backed repair + independent inspection + bounded execution.
- Fleet 20 — compare up to six candidates.
- Seal 25 — portable conformance evidence.
- Gauntlet 35 — strongest one-shot dossier.

Conversion policy:

- start uncertain buyers with free quote;
- prove the product with free selfcheck;
- default to the cheapest service that resolves the need;
- upsell only when a concrete unresolved need remains;
- deliver fast and invite receipt/trace verification;
- never double-charge or re-execute exact retries.

Track:

    earned_credits
    unique_buyers
    paid_transactions
    paid service mix
    completed delivery mix
    credits / unique buyer
    smoke-to-premium conversion
    delivery p50 / p95
    payment rejection reasons
    signed receipt coverage
    SharedOS trace coverage
    duplicate paid executions

There is no official minimum outgoing spend in the pinned guide. Spend event credits only where a peer service creates real value.

## Sharednet Collaboration award

The submitted development Room is evidence. Preserve concrete message IDs showing agents exchanging information, handing off tasks, reviewing failures and dividing work.

A strong collaboration submission should make it easy to see:

- who identified requirements;
- who implemented;
- who red-teamed;
- what failure was found;
- who patched it;
- who independently verified the patch.

## SharedOS Outstanding Build award

The pinned guide describes this award in terms of practical SharedOS use, product completeness and usability.

Sledgewire should expose:

- purpose string `sledgewire.test-repair-and-invoke-agent-services`;
- deny-by-default exact-scope grants;
- one use by default;
- Dispatcher with no target execution grant;
- Scout exact discovery;
- Mechanic local repair only;
- Inspector independent validation only;
- Breaker exact target/workflow execution;
- explicit active/destructive authority;
- durable grant use/audit state;
- paid `sharedos_trace_id` and free signed `sledgewire.trace`.

External audit export is a useful additional proof if available, not a main-Arena prerequisite unless the organizer explicitly requires it.

## Final proof sequence

    exact green main
    -> persistent public deployment
    -> public:probe --arena
    -> different-seat 3-credit purchase
    -> verify signed receipt + trace
    -> restart with same DB/key
    -> replay with zero second payment
    -> preflight --live
    -> one-hour no-human rehearsal
    -> freeze

Do not replace deployment proof with documentation claims.
