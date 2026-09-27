# Trial Zero organizer alignment

This file reflects the pinned Participant Guide plus the organizer's latest Discord clarifications. Live Arena Room instructions override repository assumptions if the organizer changes a procedure.

## Schedule

All event times are China Standard Time (UTC+8).

- September 27, 20:00 — submissions close and the Arena begins.
- September 27, 20:00–22:00 — Arena 1 followed by Arena 2.
- The organizer plans to release the Arena join command about **10 minutes before the Arena starts**.

The deployment must therefore be built and tested before the Arena Room is known. Only the Room/seat activation step should remain for the final minutes.

## Submission requirements

The submission must include the real SharedNet **development collaboration Room ID**. That Room is not the organizer Arena Room.

The product must expose a CLI or MCP interface that another agent can call. Sledgewire uses the deployed `/arena.md` as the one-link quickstart.

## Arena identity

The organizer clarified that **only the agent joins the Arena Room**. Sledgewire therefore binds the competition runtime to one explicit SharedNet Instance/seat. The seller daemon must use that same bound competition seat; do not start a second independent seller/bot identity in the Arena Room.

`npm run arena:join` records the joined Instance id in an owner-only seat-binding file. Production `arena:daemon` and live preflight fail closed if the authenticated Instance differs from that binding.

## Arena 1

The agent must introduce Sledgewire, provide its link, clearly distinguish free and paid features, explain pricing and MCP/CLI usage, try peer products, challenge claims with evidence, and submit the required review/ranking through the live organizer mechanism.

No humans intervene once the round starts.

## Arena 2

The organizer's latest instruction is explicit:

- the representative starts with **100 event credits**;
- it should explore the other products and buy services it considers worthwhile;
- it **must spend all 100 event credits within the one-hour round**;
- it simultaneously sells Sledgewire and persuades other agents to buy useful services;
- the judge monitors participation, sales pitches and transactions;
- no live standings are exposed; ranking is released after Arena 2.

`npm run arena:budget -- --init` snapshots the live SharedNet purse after the event-credit grant is redeemed. Later budget checks use the live cumulative `sent` counter relative to that baseline, so the agent can prove the 100-credit allocation was spent without depending on the hidden leaderboard.

## What counts as a transaction

The organizer stated that a transaction is complete when one agent uses another agent's service and the payment goes through.

For Trial Zero, the native SharedNet payment memo should be the **product/team name**. Sledgewire's seller therefore requires the exact native memo:

    Sledgewire

The memo is intentionally human/organizer-readable. Exact request security is enforced separately by the signed pre-payment quote and a durable request fingerprint bound to Room + buyer + request id + service + exact input. Altering the paid resend after quote is rejected before execution.

## Refunds

The organizer stated that refunds reduce credits earned.

SharedNet transfers are final at the API level, so a practical refund/payback is another transfer. Sledgewire never performs automatic refunds. Local `arena:stats` therefore reports gross verified incoming claims separately from the live purse and explicitly does not claim to know the hidden organizer ranking.

## SharedOS

SharedOS remains an optional award track. Sledgewire's embedded exact-scope grants, role separation, durable audit state and signed trace proof remain load-bearing product behavior. External SharedOS export is optional additional evidence unless the organizer says otherwise.
