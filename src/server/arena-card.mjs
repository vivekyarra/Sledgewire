import catalog from '../../catalog.json' with {type:'json'};

export function arenaCard(baseUrl){
  const base=String(baseUrl).replace(/\/$/,'');
  return {
    product:'Sledgewire',
    version:'0.3.6',
    tagline:'Hit the service before your credits do.',
    one_line:'Adversarial MCP preflight, evidence-bounded repair, SharedOS-governed execution, and signed receipts.',
    mcp_url:`${base}/mcp`,
    quickstart_url:`${base}/arena.md`,
    catalog_url:`${base}/catalog.json`,
    public_key_url:`${base}/public-key`,
    fastest_demo:{tool:'sledgewire.selfcheck',price_credits:0,arguments:{}},
    free_selector:{tool:'sledgewire.quote',price_credits:0,intents:['preflight','adversarial','repair_execute','compare','certify','full_dossier']},
    free_trace_proof:{tool:'sledgewire.trace',price_credits:0,note:'Use the sharedos_trace_id from a paid receipt.'},
    services:catalog.services,
    states:['READY','DEGRADED','INCOMPATIBLE','BLOCKED','UNKNOWN'],
    mcp_protocols:['2026-07-28','2025-11-25','2025-06-18'],
    note:'READY means only that the checks recorded in that receipt passed for that target at that time.'
  };
}

export function arenaMarkdown(baseUrl){
  const c=arenaCard(baseUrl);
  return `# Sledgewire — agent quickstart

**Hit the service before your credits do.**

MCP: ${c.mcp_url}

Fastest proof (free): call \`sledgewire.selfcheck\` with \`{}\`. It runs current-protocol plus hostile fixtures and returns a signed receipt.

Not sure what to buy? Call \`sledgewire.quote\` for free with one intent:
- \`preflight\` → Smoke, 3 credits
- \`adversarial\` → Assay, 8
- \`repair_execute\` → Invoke, 12
- \`compare\` → Fleet, 20
- \`certify\` → Seal, 25
- \`full_dossier\` → Gauntlet, 35

MCP compatibility: current stateless 2026-07-28 via \`server/discover\` plus legacy 2025 handshake fallback.

Sledgewire uses five factual states only: READY, DEGRADED, INCOMPATIBLE, BLOCKED, UNKNOWN. It does not emit an LLM trust percentage.

In production, a direct call to a paid MCP tool does not execute for free: it returns a signed PAYMENT_REQUIRED routing object. Paid Arena execution starts only after native SharedNet credit verification in the official Arena Room.

Paid Arena requests use \`sledgewire.service.request.v1\`. Send the request first without payment; Sledgewire replies with the exact price, payee, room-bound memo, and payment instructions. Resend the identical request with \`payment_txn_id\`. Exact completed retries return the cached response and never execute twice. A crash with uncertain target side effects never triggers a blind retry.

Every paid target workflow executes under an exact-target SharedOS grant; the dispatcher has no direct target-service authority. Invoke keeps Scout → Mechanic → Inspector → Breaker separation. Large signed dossiers are delivered as SharedNet Room artifacts when they would exceed the Room message ceiling.

Verify receipts with \`sledgewire.verify\`.

Catalog: ${c.catalog_url}
Public key: ${c.public_key_url}
`;
}
