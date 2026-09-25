import catalog from '../../catalog.json' with {type:'json'};

export function arenaCard(baseUrl){
  const base=String(baseUrl).replace(/\/$/,'');
  return {
    product:'Sledgewire',
    version:'0.3.2',
    tagline:'Hit the service before your credits do.',
    one_line:'Adversarial MCP preflight, evidence-bounded repair, SharedOS-governed execution, and signed receipts.',
    mcp_url:`${base}/mcp`,
    quickstart_url:`${base}/arena.md`,
    catalog_url:`${base}/catalog.json`,
    public_key_url:`${base}/public-key`,
    fastest_demo:{tool:'sledgewire.selfcheck',price_credits:0,arguments:{}},
    free_selector:{tool:'sledgewire.quote',price_credits:0,intents:['preflight','adversarial','repair_execute','compare','certify','full_dossier']},
    services:catalog.services,
    states:['READY','DEGRADED','INCOMPATIBLE','BLOCKED','UNKNOWN'],
    note:'READY means only that the checks recorded in that receipt passed for that target at that time.'
  };
}

export function arenaMarkdown(baseUrl){
  const c=arenaCard(baseUrl);
  return `# Sledgewire — agent quickstart

**Hit the service before your credits do.**

MCP: ${c.mcp_url}

Fastest proof (free): call \`sledgewire.selfcheck\` with \`{}\`. It runs hostile fixtures and returns a signed receipt.

Not sure what to buy? Call \`sledgewire.quote\` for free with one intent:
- \`preflight\` → Smoke, 3 credits
- \`adversarial\` → Assay, 8
- \`repair_execute\` → Invoke, 12
- \`compare\` → Fleet, 20
- \`certify\` → Seal, 25
- \`full_dossier\` → Gauntlet, 35

Sledgewire uses five factual states only: READY, DEGRADED, INCOMPATIBLE, BLOCKED, UNKNOWN. It does not emit an LLM trust percentage.

In production, a direct call to a paid MCP tool does not execute for free: it returns a signed PAYMENT_REQUIRED routing object. Paid Arena execution starts only after native SharedNet credit verification in the official Arena Room.

Paid Arena requests use \`sledgewire.service.request.v1\`. Send the request first without payment; Sledgewire replies with the exact price, payee, room-bound memo, and payment instructions. Resend the identical request with \`payment_txn_id\`. Exact completed retries return the cached response and never execute twice.

Every paid result is executed through SharedOS authority and returned with a signed Ed25519 receipt. Large signed dossiers are delivered as SharedNet Room artifacts when they would exceed the Room message ceiling; the compact Room reply carries the artifact link and SHA-256.

Verify receipts with \`sledgewire.verify\`.

Catalog: ${c.catalog_url}
Public key: ${c.public_key_url}
`;
}
