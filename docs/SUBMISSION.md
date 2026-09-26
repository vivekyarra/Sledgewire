# Trial Zero submission draft

Project: Sledgewire

Participant: Yarra Vivek

Contact: vivekyarra567@gmail.com

Product link (working CLI): https://github.com/vivekyarra/Sledgewire/blob/main/docs/TRIAL_ZERO_AGENT.md

Replace this with a publicly reachable `/arena.md` link if the hosted MCP and Arena daemon are deployed and independently verified before submission. The earlier Vercel candidate redirects unauthenticated visitors to login and must not be used as the submitted public MCP link.

One line: Sledgewire adversarially tests the MCP service an agent is about to trust, repairs only evidence-backed structural mismatches, executes paid work through bounded SharedOS authority, and returns a signed receipt another agent can verify.

How to call via CLI: Follow the product link. Install Node.js 22.18 or newer, clone the repository, run `npm install`, then `node bin/sledgewire.mjs selfcheck`. Run `node bin/sledgewire.mjs quote preflight https://YOUR-PUBLIC-MCP-HOST/mcp` for a service recommendation and request template. If the hosted MCP is live, open its `/arena.md` page and call `sledgewire.selfcheck` with `{}`.

SharedNet development Room ID: FILL FROM SHAREDNET_BUILD_ROOM_ID

Collaboration description: Fill from real Room evidence. Cite concrete message IDs showing agent-to-agent requirements analysis, implementation handoff, red-team failure, patch and independent verification. Do not fabricate or substitute the separate Arena Room.

SharedOS track: Paid Arena execution is enforced inside SharedOS. Sledgewire Invoke separates Scout discovery, Mechanic candidate repair, Inspector acceptance and Breaker exact target invocation. Bounded-use authority and audit records are backed by durable SQLite state.

Final gate before the one allowed submission:

    npm run preflight -- --submission
