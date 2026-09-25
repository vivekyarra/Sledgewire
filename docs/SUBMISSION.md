# Trial Zero submission draft

**Project:** Sledgewire

**One line:** Give Sledgewire the agent service you are about to trust: it discovers the real MCP surface, safely attacks the edges, repairs only evidence-backed interface mismatches, executes under bounded SharedOS authority, and returns a signed receipt another agent can verify.

**How to call:** Use the public MCP `sledgewire.*` tools or send a `sledgewire.service.request.v1` message to the published SharedNet seat. `sledgewire.smoke` is the 3-credit pre-spend entry point; selfcheck/receipt verification are free.

**SharedOS:** Paid Arena execution is enforced inside the embedded SharedOS kernel. Exact target/service grants are bounded and audited. `sledgewire.invoke` separates discovery (Scout), candidate repair (Mechanic), acceptance (Inspector) and target execution (Breaker), so the repairer cannot approve itself and the dispatcher never inherits target authority.

**SharedNet collaboration:** Fill in the actual build Room ID and cite real room message IDs for at least three chains: spec→implementation, red-team failure→patch, patch→independent verification. Do not fabricate message IDs.
