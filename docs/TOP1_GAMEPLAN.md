# Trial Zero top-score game plan

No code change can guarantee first place because Arena 1 rankings and Arena 2 buyer demand are external. The goal is to remove avoidable losses.

## Arena 1: judge-agent confidence

The first 30 seconds should prove the product:

    problem -> free selfcheck -> signed proof -> real target quote -> smallest useful paid check -> trace verification

Keep architecture behind the proof. A judge should quickly understand:

- what Sledgewire does;
- what is free;
- what each paid tier costs;
- how to call it;
- what READY does and does not mean;
- how to verify a receipt.

Use peer trials to produce specific critiques and improve interaction quality.

## Arena 2: two simultaneous score obligations

### Earn

Maximize legitimate incoming credits by minimizing purchase friction:

- free quote/selfcheck;
- 3-credit Smoke as the first paid step;
- upsell only when the cheaper result leaves a real unresolved need;
- fast signed delivery;
- exact replay without duplicate charge/execution.

### Spend

The organizer now explicitly requires the representative to spend all **100 event credits within one hour**.

Initialize the live baseline exactly once with `npm run arena:budget -- --init`. Repeating `--init` must return `already_initialized`, never rebase the obligation. Track cumulative `sent`, not wallet balance, because incoming sales can increase the purse. Use the exact-spend planner on discovered worthwhile offers. Prioritize seller diversity and real utility, close the denomination gap before the deadline, and stop obligation-driven spending if `overspent_credits` becomes positive.

Do not wait for a live ranking; none is provided.

## Payment compatibility

Incoming Sledgewire payments must use native memo `Sledgewire`, matching the organizer's product/team-name instruction.

Security remains strong because request identity is not delegated to that public memo. The pre-payment signed quote and durable quote record bind:

    Arena Room
    buyer seat
    request id
    service
    exact input fingerprint
    price
    payee

A changed paid resend is rejected before ledger-backed execution. Signed payment quotes expire after four hours. If payment verification is temporarily rate-limited, wait for `retry_after_ms` and resend the **same** paid request with the **same** transaction id; never create a duplicate transfer.

## Refund discipline

Refunds reduce earned credits. Sledgewire does not automatically refund successful or idempotent work. Exact retries replay the original outcome. Genuine paybacks, if ever required, are deliberate and visible; local gross claims are not presented as the hidden organizer score.

## One-seat rule

Only the official competition agent seat joins. The daemon must authenticate as that bound seat. A second independent seller/bot seat is a launch blocker.

## Final sequence

    exact green branch
    -> stress:arena-e2e + stress:http green
    -> merge main
    -> deploy exact main
    -> organizer Room released
    -> bind single seat
    -> public probe
    -> second-seat Smoke purchase
    -> restart replay
    -> preflight --live
    -> initialize 100-credit budget
    -> autonomous Arena
