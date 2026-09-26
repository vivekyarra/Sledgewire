# Competition game plan

Winning cannot be guaranteed because other agents and products are external. The engineering objective is to remove avoidable ways Sledgewire can become ineligible, fail to convert demand, or fail to prove its SharedOS design.

## Zero-th priority: stay eligible

The representative agent contract in `docs/ARENA_AGENT_PROMPT.md` is a hard operating constraint, not advice.

Round 1 must finish with:

- at least 3 distinct peer products actually tried;
- at least one specific evidence-based disagreement posted for every product tried;
- the official ranking submitted and accepted.

Round 2 must finish with:

- at least 80 confirmed Arena credits spent;
- purchases covering at least 3 distinct peer products;
- only legitimate official transactions counted.

The seller and representative agent must remain online for the full Arena, with no human rescue path.

## Agents' Choice: be easiest to evaluate

The strongest short sequence is:

    one-line problem
    -> free sledgewire.selfcheck
    -> signed proof
    -> free quote against the peer's real target
    -> smallest useful paid service
    -> independent receipt / trace verification

Do not lead with architecture. Demonstrate the product, then expose the authority map when the peer wants to inspect why the result is trustworthy.

For every peer product Sledgewire's representative tries, record the exact call, observed result, one concrete strength, and one concrete disagreement or limitation. That produces a defensible ranking instead of generic commentary.

## Top Earner: remove purchase friction

The primary scoreboard metric is gross valid incoming credits. Reliability and conversion are therefore one system.

Use `npm run arena:stats` to track:

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

Hard reliability targets:

    duplicate paid executions = 0
    wrong-buyer deliveries    = 0
    wrong-room deliveries     = 0
    unsigned paid deliveries  = 0
    paid delivery without SharedOS trace = 0
    seller /ready red while advertising availability = 0

Commercial ladder:

- Smoke 3: lowest-friction pre-spend reality check.
- Assay 8: adversarial protocol/safety checks.
- Invoke 12: evidence-backed repair + independent inspection + bounded execution.
- Fleet 20: compare up to six candidate services.
- Seal 25: portable conformance evidence.
- Gauntlet 35: strongest seller/buyer dossier.

The free quote must route buyers to the smallest service that satisfies their stated need. Premium conversion should come from unresolved evidence, not pressure.

## Judges' Pick: make SharedOS inspectable

A judge should not need to infer the authority design from source code.

Sledgewire exposes and documents:

- purpose string: `sledgewire.test-repair-and-invoke-agent-services`;
- deny-by-default exact-scope grants;
- one use by default;
- Dispatcher with no target execution grant;
- Scout with exact discovery authority;
- Mechanic with local repair authority only;
- Inspector with independent validation authority only;
- Breaker with exact target/workflow execution authority;
- explicit request authority for active/destructive mutations;
- durable grant usage and audit state;
- paid `sharedos_trace_id` plus free signed `sledgewire.trace`;
- event-visible external SharedOS decision evidence as a mandatory final live-gate condition.

The full map is in `docs/SHAREDOS_AUTHORITY_MAP.md`, while the deployed `/arena.json` exposes the concise machine-readable form.

Sledgewire deliberately does not create new target authority from arbitrary Room text. In a no-human Arena, a destructive or active request without explicit authority stays blocked instead of silently escalating itself.

## Live proof sequence

Do not replace the product link with a hosted seller until this exact chain is green:

    persistent deployment
    -> external public:probe --arena
    -> different-seat 3-credit arena:rehearse
    -> seller restart with persistent DB/key
    -> arena:replay-after-restart
    -> visible external SharedOS audit evidence
    -> preflight --live

A live gate that is red is a deployment fact, not a documentation problem. Never paper over it.

## What not to build now

Do not add generic chat, a dashboard, an LLM trust score, speculative reputation, or extra paid SKUs merely to look larger. Every new surface creates discovery cost and failure modes.

Do not optimize only for Top Earner. The product should simultaneously be easy for agents to try, economically useful enough to buy, and simple for organizers to audit.
