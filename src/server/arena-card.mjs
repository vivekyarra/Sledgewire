import catalog from '../../catalog.json' with {type:'json'};
import {VERSION} from '../version.mjs';
import {PAYMENT_QUOTE_TTL_MS} from '../store/arena-store.mjs';

export function arenaCard(baseUrl){
  const base=String(baseUrl).replace(/\/$/,'');
  return {
    product:'Sledgewire',
    version:VERSION,
    tagline:'Hit the service before your credits do.',
    one_line:'Pre-spend adversarial verification for MCP services: real checks, evidence-bounded repair, SharedOS-governed execution, and signed receipts.',
    scope:'MCP services',
    mcp_url:`${base}/mcp`,
    quickstart_url:`${base}/arena.md`,
    catalog_url:`${base}/catalog.json`,
    public_key_url:`${base}/public-key`,
    health_url:`${base}/health`,
    readiness_url:`${base}/ready`,
    arena1_judge_path:[
      {step:1,action:'check readiness',url:`${base}/ready`},
      {step:2,action:'call free proof',tool:'sledgewire.selfcheck',arguments:{}},
      {step:3,action:'verify signed receipt',tool:'sledgewire.verify'},
      {step:4,action:'test a real MCP target',tool:'sledgewire.quote',example_arguments:{intent:'preflight',endpoint:'https://target.example/mcp'}}
    ],
    arena2_buyer_path:{
      safest_entry:{tool:'sledgewire.quote',price_credits:0},
      best_first_paid:{service:'sledgewire.smoke',price_credits:3,why:'lowest-cost real target check before spending more'},
      purchase_flow:['check /ready','send paid request without payment','receive buyer-bound signed quote with exact request fingerprint','pay exact native SharedNet credits to quoted payee with memo Sledgewire','resend identical request with payment_txn_id','verify signed delivery and trace']
    },
    fastest_demo:{tool:'sledgewire.selfcheck',price_credits:0,arguments:{}},
    free_selector:{tool:'sledgewire.quote',price_credits:0,intents:['preflight','adversarial','repair_execute','compare','certify','full_dossier'],aliases:['check','security','repair','choose','conformance','dossier'],note:'Only send/pay the returned request when request_ready is true; otherwise fill missing_fields and quote again.'},
    free_trace_proof:{tool:'sledgewire.trace',price_credits:0,note:'Use the sharedos_trace_id from a paid receipt.'},
    proofs:{
      signed_receipts:'Ed25519 public-key verifiable',
      paid_authority:'exact-scope purpose-bound SharedOS grants',
      replay:'exact completed retries return the durable cached result without second execution',
      paid_trace:'receipt sharedos_trace_id -> free sledgewire.trace'
    },
    payment:{
      native_sharednet_memo:'Sledgewire',
      memo_policy:'Trial Zero organizer product/team-name memo',
      quote_ttl_seconds:Math.floor(PAYMENT_QUOTE_TTL_MS/1000),
      request_binding:'signed buyer-bound quote + durable exact request fingerprint',
      note:'The public memo is intentionally not the request fingerprint; altered paid resends are rejected against the stored signed-quote binding before ledger execution.'
    },
    limits:{
      ready_semantics:'READY means only the recorded checks passed for that target at that time.',
      active_actions:'Active/destructive target actions require explicit request authority.',
      target_scope:'Sledgewire evaluates MCP interfaces; it does not claim universal safety of the remote system.'
    },
    sharedos_authority:{
      purpose:'sledgewire.test-repair-and-invoke-agent-services',
      policy:'deny-by-default; exact-scope; purpose-bound; one-use grants by default',
      roles:{
        dispatcher:'coordinates only; receives no target execution grant',
        scout:'exact target/tool discovery only',
        mechanic:'local evidence-bounded structural repair only',
        inspector:'independent repair validation only',
        breaker:'exact target/workflow execution only'
      },
      active_authority:'destructive or active mutations require explicit request authority; Room text alone never mints authority',
      proof:{receipt_field:'sharedos_trace_id',tool:'sledgewire.trace'}
    },
    room_examples:[
      '@sledgewire demo',
      '@sledgewire preflight https://target.example/mcp',
      '@sledgewire security https://target.example/mcp',
      '@sledgewire compare https://a.example/mcp https://b.example/mcp'
    ],
    paid_request_example:{type:'sledgewire.service.request.v1',request_id:'buyer-unique-id',service:'sledgewire.smoke',input:{endpoint:'https://target.example/mcp'}},
    services:catalog.services,
    states:['READY','DEGRADED','INCOMPATIBLE','BLOCKED','UNKNOWN'],
    mcp_protocols:['2026-07-28','2025-11-25','2025-06-18']
  };
}

export function arenaMarkdown(baseUrl){
  const c=arenaCard(baseUrl);
  return [
    '# Sledgewire — agent quickstart',
    '',
    '**Hit the service before your credits do.**',
    '',
    'Sledgewire gives agents **pre-spend evidence for MCP services**: it calls the real MCP surface, runs bounded adversarial checks, repairs only evidence-backed structural mismatches, executes paid work under exact SharedOS authority, and returns signed receipts.',
    '',
    `MCP: ${c.mcp_url}`,
    `Readiness: ${c.readiness_url}`,
    '',
    '## 30-second judge path',
    '',
    `1. Check \`${c.readiness_url}\`.`,
    '2. Call free `sledgewire.selfcheck {}`.',
    '3. Verify the returned signed receipt.',
    '4. Give Sledgewire a real MCP target with free `sledgewire.quote {"intent":"preflight","endpoint":"https://target.example/mcp"}`.',
    '',
    'No target yet? The selfcheck is still free and demonstrates Sledgewire\'s own hostile-fixture fail-closed behavior.',
    '',
    '## Fast buyer path',
    '',
    'Not sure what to buy? Call `sledgewire.quote` free. It accepts canonical intents plus simple aliases such as `check`, `security`, `repair`, `choose`, `conformance`, and `dossier`.',
    '',
    '- `preflight` → **Smoke, 3 credits** — lowest-friction real target check',
    '- `adversarial` → **Assay, 8**',
    '- `repair_execute` → **Invoke, 12**',
    '- `compare` → **Fleet, 20**',
    '- `certify` → **Seal, 25**',
    '- `full_dossier` → **Gauntlet, 35**',
    '',
    'Room shorthand also works without executing anything: `@sledgewire preflight https://target.example/mcp` returns the exact quote/request template.',
    '',
    '## Purchase safely',
    '',
    'Paid requests use `sledgewire.service.request.v1`. Send the request **without payment first**. Sledgewire returns a buyer-bound signed quote containing the exact price, payee, exact request fingerprint, deliverable and verification path. For Trial Zero, the native SharedNet memo is the product name `Sledgewire`. Pay that transfer, then resend the identical request with `payment_txn_id`.',
    '',
    'Request security does not depend on putting secrets or fingerprints in the public memo: the signed quote plus durable seller binding locks Room + buyer + request id + service + exact input. Changing the endpoint/input after quote is rejected before ledger-backed execution.',
    '',
    'Exact completed retries return the durable cached delivery and never execute twice. A crash with uncertain target side effects never triggers a blind retry.',
    '',
    '## Verify, don\'t trust the pitch',
    '',
    'Every paid delivery is signed. Use `sledgewire.verify`. Paid receipts carry `sharedos_trace_id`; call free `sledgewire.trace` to inspect its sanitized signed SharedOS authority trail.',
    '',
    'Every paid target workflow uses an exact-target, purpose-bound SharedOS grant with one use by default. Dispatcher has no target execution grant. Invoke keeps Scout → Mechanic → Inspector → Breaker authority separation. Room text never creates active/destructive authority.',
    '',
    '## Scope and limits',
    '',
    'Sledgewire is deliberately focused on MCP services. READY means only that the checks recorded in that receipt passed for that target at that time. Active/destructive target actions require explicit authority. Assay remains passive unless active checks are explicitly authorized.',
    '',
    `Machine-readable card: ${c.quickstart_url.replace('/arena.md','/arena.json')}`,
    `Catalog: ${c.catalog_url}`,
    `Public key: ${c.public_key_url}`,
    ''
  ].join('\n');
}
