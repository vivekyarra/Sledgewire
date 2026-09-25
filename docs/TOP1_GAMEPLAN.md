# First-place-oriented game plan

First place cannot be guaranteed because the field and judge behavior are external. The engineering target is to remove the avoidable reasons Sledgewire could lose either Arena.

## Arena 1 objective

Required targets:

- one-link instructions load successfully;
- free selfcheck fits naturally in the conversation;
- receipt verifies independently;
- multiple real peer products are tried when the field allows it;
- every direct product question receives a factual answer;
- critiques cite observed tests rather than generic opinions;
- no human rescue is needed;
- no security claim exceeds what a receipt proves.

Strongest short sequence:

    one-line problem
    -> call sledgewire.selfcheck
    -> show hostile fixture contained and bad protocol rejected
    -> verify receipt
    -> explain SharedOS role separation only if asked

## Arena 2 objective

The organizer ranks by valid credits earned, so the primary scoreboard metric is gross valid incoming credits, not nominal balance.

Track automatically with `npm run arena:stats` (gross earned credits are derived from verified payment claims, including a valid payment whose execution later fails):

    earned_credits
    unique_buyers
    buyers / other_agents
    paid_transactions
    credits / unique_buyer
    smoke-to-premium conversion
    delivery p50 / p95
    invalid payment rejections
    signed/trace evidence coverage
    duplicate paid executions

Hard reliability targets:

    duplicate paid executions = 0
    wrong-buyer deliveries    = 0
    wrong-room deliveries     = 0
    unsigned paid deliveries  = 0
    paid delivery without SharedOS trace = 0

Commercial coverage:

- Smoke 3: impulse purchase before another service is trusted.
- Assay 8: deeper adversarial check.
- Invoke 12: buyer has a real broken call and wants it executed.
- Fleet 20: buyer compares several sellers.
- Seal 25: seller purchases portable proof.
- Gauntlet 35: seller purchases the strongest one-shot dossier.

This covers both sides of the market: buyers reduce integration risk and sellers buy portable evidence.

## Revenue sensitivity

Run npm run economy. The script prints deterministic adoption scenarios across several field sizes. It is a sensitivity model, not a prediction.

## What not to do

Do not add generic chat, a dashboard, an LLM trust score, speculative reputation, or more services merely to look larger. Every additional surface adds discovery cost and failure modes.

Do not optimize for top three. Ask a harder question: if Sledgewire loses first, was it because another product genuinely created more value, or because we left an avoidable integration, evidence, latency or conversion failure? Only the former is acceptable.
