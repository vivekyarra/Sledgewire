# Trial Zero submission record

Project: Sledgewire

Participant: Yarra Vivek

Contact: https://github.com/vivekyarra

Current submitted product and call guide: https://sledgewire-trial-zero-public.vercel.app/arena.md

Source: https://github.com/vivekyarra/Sledgewire

The current submitted Vercel URL is a public CLI/stdio-MCP quickstart only. As of 2026-09-27, hosted `/health`, `/ready`, `/mcp`, `/arena.json`, `/catalog.json`, `/public-key`, and `/.well-known/agent.json` are not live there. Do not describe that static shell as the live Arena seller. Replace the submitted product URL with a deployed `/arena.md` only after the full service passes `public:probe` and the live gate.

One line: Sledgewire adversarially tests the MCP service an agent is about to trust, repairs only evidence-backed structural mismatches, executes paid work through bounded SharedOS authority, and returns a signed receipt another agent can verify.

How another agent calls it now:

```sh
git clone https://github.com/vivekyarra/Sledgewire.git
cd Sledgewire
npm ci --ignore-scripts
node bin/sledgewire.mjs selfcheck
node bin/sledgewire.mjs quote preflight https://TARGET-HOST/mcp
```

Local stdio MCP is available with:

```sh
npm run mcp
```

When the full hosted seller is live, the single-link path becomes the deployed `/arena.md`; another agent can check `/ready`, call free `sledgewire.selfcheck {}`, verify the returned signature, and use free `sledgewire.quote` before any paid request.

SharedNet development Room ID: `rom_dbAOS6Ws4F`

Collaboration evidence recorded in the public Trial Zero listing:

- Architect request: `msg_r5TyNbgWlY`
- Independent Breaker finding: `msg_IVJxowuyMR`
- Builder correction: `msg_qyzG5hblOW`
- Independent verification: `msg_YG9BDrZAOJ`

Collaboration description: Two Codex seats collaborated in the development Room. The architect handed off the requirement, the independent Breaker found that the public guide worked while the draft still claimed a login redirect and could be mistaken for a hosted MCP service, the builder corrected the submission wording, and the other seat independently checked the public routes, Room history, and submission preflight. The development Room is intentionally separate from the organizer Arena Room.

SharedOS track: Paid Arena execution uses deny-by-default, bounded-use SharedOS authority for discovery, candidate repair, independent acceptance, and exact target invocation. The dispatcher receives no target execution authority. Durable SQLite audit state backs the grants, and paid receipts expose a `sharedos_trace_id` that can be inspected through free `sledgewire.trace`. Event-visible SharedOS Cloud evidence and live Arena selling still require live verification.

Final submission-shape gate for the currently submitted guide:

```sh
export SLEDGEWIRE_PRODUCT_URL=https://sledgewire-trial-zero-public.vercel.app/arena.md
export SLEDGEWIRE_PARTICIPANT_NAME='Yarra Vivek'
export SLEDGEWIRE_CONTACT=https://github.com/vivekyarra
export SHAREDNET_BUILD_ROOM_ID=rom_dbAOS6Ws4F
npm run preflight -- --submission
```

Before changing the product URL to a live seller, run:

```sh
npm run public:probe -- https://YOUR-LIVE-HOST --arena
npm run arena:rehearse
# restart the real Arena daemon while preserving DB and signing key
npm run arena:replay-after-restart
npm run preflight -- --live
```

Only after the relevant live checks are green should the product URL be switched to `https://YOUR-LIVE-HOST/arena.md`. Do not create a second project submission; update the existing project entry if the event site permits editing.
