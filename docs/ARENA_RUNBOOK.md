# Trial Zero Arena runbook

## Before the 10-minute join window

Complete everything that does not depend on the organizer Arena Room:

1. Freeze the exact green commit.
2. Verify the existing submission and real SharedNet development Room ID.
3. Deploy the persistent public service and signing key/database.
4. Prove `/health`, `/arena.md`, `/arena.json`, `/public-key` and modern `/mcp`.
5. Keep the organizer invite/token out of prompts, shell argv and repository files.
6. Have the representative-agent prompt ready.
7. Redeem the 100-credit code when the organizer releases it; do not spend before the Arena instruction permits it.

## When the organizer releases the join command

Extract/use the exact organizer Room and invite out of band:

    export SHAREDNET_ARENA_ROOM_ID=rom_...
    export SHAREDNET_INVITE_TOKEN=rit_...
    export SHAREDNET_PAYEE_ADDRESS=pri_...
    npm run arena:join

The join command writes:

- the member token owner-only;
- the exact joined Instance/seat id owner-only;
- retry-safe join state.

Remove `SHAREDNET_INVITE_TOKEN` immediately after join.

For a single-container host, the fastest cold-start path is:

    npm run arena:activate

which performs the same join and starts the public + daemon supervisor. Do not run a second Arena identity in parallel.

## Final room-specific checks

1. `/ready` shows a fresh daemon heartbeat.
2. Daemon Instance equals the bound Arena seat.
3. Configured payee belongs to that same SharedNet identity.
4. `npm run public:probe -- https://PUBLIC-HOST --arena` is green.
5. From a different buyer seat, `npm run arena:rehearse` completes one genuine Smoke purchase.
6. Restart daemon with DB/key preserved; `npm run arena:replay-after-restart` proves identical replay with zero second payment.
7. `npm run stress:arena-e2e -- 40000 10000` and `npm run stress:http -- 64 32` are green on the exact deployed release branch.
8. `npm run preflight -- --live` is green.

## Arena 1

- Introduce Sledgewire once.
- Provide the product link, free/paid split, prices and MCP calling instructions.
- Lead with free selfcheck.
- Try peers with real tasks.
- Record concrete strengths and limitations.
- Answer challenges with receipts/traces rather than slogans.
- Submit the required review/ranking before close.

## Arena 2

After the 100-credit grant is present:

    npm run arena:budget -- --init

The organizer requires all 100 event credits to be spent in the one-hour round. Maintain discovered worthwhile peer offers and periodically run:

    npm run arena:budget -- --offers offers.json

Do not infer progress from current wallet balance alone because sales increase the purse. The budget controller uses cumulative SharedNet `sent` relative to the Arena baseline. Re-running `--init` must report `already_initialized` rather than rebasing. Stop obligation-driven spending if `overspent_credits` is positive.

Seller payment contract:

- native memo: `Sledgewire`;
- signed quote contains the exact request fingerprint and a 4-hour expiry;
- durable quote binding rejects post-quote request changes;
- valid payment -> SharedOS -> signed delivery;
- exact retry -> cached result, no second execution;
- `payment_verification_rate_limited` -> wait `retry_after_ms`, then resend the same request/txn; never pay again;
- no automatic refunds.

No live scoreboard exists; optimize useful sales and finish the outgoing 100-credit obligation independently.

## Stop conditions

Do not enter autonomous competition unless:

- exact commit CI green;
- public deployment exact-version green;
- one Arena seat bound and authenticated;
- payee/Room correct;
- real second-seat paid rehearsal green;
- restart replay green;
- duplicate-execution stresses green;
- payment memo is exactly `Sledgewire`;
- changed request after quote is rejected before ledger execution;
- budget controller initializes from live SharedNet purse;
- representative agent can complete a no-human rehearsal.
