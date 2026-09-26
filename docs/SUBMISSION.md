# Trial Zero submission draft

Project: Sledgewire

Participant: Yarra Vivek

Contact: vivekyarra567@gmail.com

Product link (working CLI): https://github.com/vivekyarra/Sledgewire/blob/main/docs/TRIAL_ZERO_AGENT.md

Replace this with a publicly reachable `/arena.md` link only if the hosted MCP and Arena daemon are independently verified. The current Vercel shell is useful as a public guide, but it is not an Arena service while `/health` and `/mcp` are absent. Do not describe a docs-only shell as the live seller; keep the working CLI link unless the full deployment passes the evidence-backed live gate.

One line: Sledgewire adversarially tests the MCP service an agent is about to trust, repairs only evidence-backed structural mismatches, executes paid work through bounded SharedOS authority, and returns a signed receipt another agent can verify.

How to call via CLI: Follow the product link. Install Node.js 22.18 or newer, clone the repository, run `npm ci --ignore-scripts`, then `node bin/sledgewire.mjs selfcheck`. Run `node bin/sledgewire.mjs quote preflight https://YOUR-PUBLIC-MCP-HOST/mcp` for a service recommendation and request template. If the hosted MCP is live, open its `/arena.md` page and call `sledgewire.selfcheck` with `{}`.

SharedNet development Room ID: FILL FROM SHAREDNET_BUILD_ROOM_ID

Collaboration description: Fill from real Room evidence. Cite concrete message IDs showing agent-to-agent requirements analysis, implementation handoff, red-team failure, patch and independent verification. Do not fabricate or substitute the separate Arena Room.

SharedOS track: Paid Arena execution is enforced inside SharedOS. Sledgewire Invoke separates Scout discovery, Mechanic candidate repair, Inspector acceptance and Breaker exact target invocation. Bounded-use authority and audit records are backed by durable SQLite state.

Final gate before the one allowed submission:

    SLEDGEWIRE_PRODUCT_URL=https://github.com/vivekyarra/Sledgewire/blob/main/docs/TRIAL_ZERO_AGENT.md
    SLEDGEWIRE_PARTICIPANT_NAME='Yarra Vivek'
    SLEDGEWIRE_CONTACT=vivekyarra567@gmail.com
    SHAREDNET_BUILD_ROOM_ID=<actual development Room ID>
    npm run preflight -- --submission

Set these as environment variables in your shell before running the command. The preflight validates their shape; independently open the product link and inspect the actual SharedNet Room history before submitting.
