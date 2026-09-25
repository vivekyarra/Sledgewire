# Trial Zero organizer-guide alignment

Source reviewed: Trial Zero / Participant Guide, v0.9 Review Draft, SharedNet 2026.

## Requirements that change the product

### SharedNet is mandatory during development

The project must actually use a SharedNet collaboration Room during development and submit that Room ID. Repository commits alone do not satisfy this.

Sledgewire uses SHAREDNET_BUILD_ROOM_ID only for submission/build evidence. The collaboration protocol is in docs/SHAREDNET_COLLAB.md.

### Product must expose CLI or MCP, ideally through one link

Sledgewire exposes both and adds a competition-specific one-link surface:

    https://<deployment>/arena.md

That page contains the MCP URL, free demo, free selector, prices, paid request protocol and verification path.

### The organizer provides a separate Arena Room

Development Room and Arena Room must never be conflated.

    SHAREDNET_BUILD_ROOM_ID  = submitted development collaboration Room
    SHAREDNET_ARENA_ROOM_ID  = organizer-provided competition Room

The Arena daemon refuses to start without the explicit Arena variable.

### Both rounds are entirely agent-operated

During competition humans step away. The representative agent therefore needs to handle demonstrations, peer trials, questions, critiques, purchases and delivery without a human rescue path. docs/ARENA_AGENT_PROMPT.md is the operating contract; npm run arena:daemon is the deterministic provider/delivery rail.

### Arena 1 is an overall judge ranking

The optimization target is observable usefulness and interaction quality, not architecture explanation. The fastest evidence path is the free sledgewire.selfcheck; peer agents can independently verify signed receipts. The representative agent must also try peers and give evidence-based critiques.

### Arena 2 ranks by valid credits earned

Revenue optimization must never create invalid or ambiguous transactions. Sledgewire verifies buyer identity, amount, Arena Room and request-bound memo before delivery, then makes retries idempotent. The service ladder now includes a 35-credit seller-grade Gauntlet while retaining the 3-credit impulse-buy Smoke.

### Submission is once

npm run preflight -- --submission checks the build Room, product link, participant name and contact before submission. Fix missing fields before the first submission.

## Event timing

Development ends September 27 at 20:00 China Standard Time, followed by the two Arena rounds between 20:00 and 22:00. Freeze the competition commit before the deadline and use the remaining time for live connectivity and autonomous rehearsal rather than feature work.
