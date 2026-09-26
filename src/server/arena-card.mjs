import catalog from '../../catalog.json' with {type:'json'};
import {VERSION} from '../version.mjs';

export function arenaCard(baseUrl){
  const base=String(baseUrl).replace(/\/$/,'');
  return {
    product:'Sledgewire',
    version:VERSION,
    tagline:'Hit the service before your credits do.',
    one_line:'Adversarial MCP preflight, evidence-bounded repair, SharedOS-governed execution, and signed receipts.',
    mcp_url:`${base}/mcp`,
    quickstart_url:`${base}/arena.md`,
    catalog_url:`${base}/catalog.json`,
    public_key_url:`${base}/public-key`,
    health_url:`${base}/health`,
    readiness_url:`${base}/ready`,
    fastest_demo:{tool:'sledgewire.selfcheck',price_credits:0,arguments:{}},
    free_selector:{tool:'sledgewire.quote',price_credits:0,intents:['preflight','adversarial','repair_execute','compare','certify','full_dossier'],note:'Only send the returned paid request when request_ready is true; otherwise fill missing_fields and quote again.'},
    free_trace_proof:{tool:'sledgewire.trace',price_credits:0,note:'Use the sharedos_trace_id from a paid receipt.'},
    paid_request_example:{type:'sledgewire.service.request.v1',request_id:'buyer-unique-id',service:'sledgewire.smoke',input:{endpoint:'https://target.example/mcp'}},
    purchase_flow:['check readiness_url','send request without payment','receive exact signed payment quote','pay native SharedNet credits to quoted payee/memo','resend identical request with payment_txn_id','verify signed receipt and trace'],
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
Readiness: ${c.readiness_url}

Fastest proof (free): call \`sledgewire.selfcheck\` with \`{}\`. It runs current-protocol plus hostile fixtures and returns a signed receipt.

Not sure what to buy? Call \`sledgewire.quote\` for free with one intent. Only send/pay the returned request when \`request_ready\` is true; otherwise fill \`missing_fields\` and quote again:
- \`preflight\` → Smoke, 3 credits
- \`adversarial\` → Assay, 8
- \`repair_execute\` → Invoke, 12
- \`compare\` → Fleet, 20
- \`certify\` → Seal, 25
- \`full_dossier\` → Gauntlet, 35

MCP compatibility: current stateless 2026-07-28 via \`server/discover\` plus legacy 2025 handshake fallback.\n\nAssay is passive unless active checks are explicitly authorized: selected-tool invalid-argument/replay checks require \`probe.safe=true\`; the synthetic unknown-tool mutation separately requires \`probe.authorizeUnknownToolProbe=true\`. If either authority is absent, that check is reported as not tested.

Sledgewire uses five factual states only: READY, DEGRADED, INCOMPATIBLE, BLOCKED, UNKNOWN. It does not emit an LLM trust percentage.

In production, a direct call to a paid MCP tool does not execute for free: it returns a signed PAYMENT_REQUIRED routing object. Paid Arena execution starts only after native SharedNet credit verification in the official Arena Room.

Paid Arena requests use \`sledgewire.service.request.v1\`, for example \`{"type":"sledgewire.service.request.v1","request_id":"buyer-unique-id","service":"sledgewire.smoke","input":{"endpoint":"https://target.example/mcp"}}\`. Check \`${c.readiness_url}\` first. Send the request without payment; Sledgewire replies with the exact price, payee, room-bound memo, and payment instructions. Resend the identical request with \`payment_txn_id\`. Exact completed retries return the cached response and never execute twice. A crash with uncertain target side effects never triggers a blind retry.

Every paid target workflow executes under an exact-target SharedOS grant; the dispatcher has no direct target-service authority. Invoke keeps Scout → Mechanic → Inspector → Breaker separation. Large signed dossiers are delivered as SharedNet Room artifacts when they would exceed the Room message ceiling.

Verify receipts with \`sledgewire.verify\`. For any paid receipt, call free \`sledgewire.trace\` with its \`sharedos_trace_id\` to inspect the sanitized, signed SharedOS authority trail.

Catalog: ${c.catalog_url}
Public key: ${c.public_key_url}
`;
}
