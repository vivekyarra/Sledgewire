# Trial Zero organizer-guide alignment

Sources reviewed: current Shared OS Hackathon Devpost requirements/rules plus the repository's Trial Zero participant-guide notes. Current organizer instructions override stale draft timing/details.

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

### Arena 1 has a hard participation floor

The representative agent must try at least three distinct peer products, post at least one specific disagreement for every product it tried, and submit the official ranking. These are eligibility conditions, not optional optimization. The fastest Sledgewire evidence path is the free `sledgewire.selfcheck`; peer agents can independently verify signed receipts and trace proofs.

### Arena 2 ranks by valid credits earned and has a buyer-side spend floor

The representative agent must confirm at least 80 of its 100 credits spent across at least three distinct peer products, while Sledgewire simultaneously competes for incoming credits. Revenue optimization must never create invalid or ambiguous transactions. Sledgewire verifies buyer identity, amount, Arena Room and request-bound memo before delivery, then makes retries idempotent. The service ladder includes a 35-credit seller-grade Gauntlet while retaining the 3-credit low-friction Smoke.

### Submission is once

npm run preflight -- --submission checks the build Room, product link, participant name and contact before submission. Fix missing fields before the first submission.

## Event timing

Do not encode a draft-guide time as runtime truth. Before handoff, the representative agent must read the current organizer/Room instructions and operate for the full official Arena window. Freeze the competition commit before the applicable deadline and use remaining preparation time for live connectivity and autonomous rehearsal rather than speculative feature work.
