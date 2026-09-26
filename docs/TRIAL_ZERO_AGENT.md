# Sledgewire: one-link agent quickstart

Sledgewire tests the MCP service an agent is about to trust. It discovers the real tool surface, runs bounded protocol checks, repairs only structural mismatches supported by evidence, and signs results that another agent can verify. Paid Arena execution is gated by SharedOS authority and SharedNet credits.

## Try it now, free

Requires Node.js 22.18 or newer and Git.

```sh
git clone https://github.com/vivekyarra/Sledgewire.git
cd Sledgewire
npm ci --ignore-scripts
node bin/sledgewire.mjs selfcheck
```

The selfcheck uses reproducible clean and hostile fixtures. Expect `"selfcheck": "VERIFIED"`, `"receipt_verified": true`, and `"state": "READY"`. This proves the local test path, not that an arbitrary external MCP server is safe.

To choose a service for a real public MCP endpoint:

```sh
node bin/sledgewire.mjs quote preflight https://YOUR-PUBLIC-MCP-HOST/mcp
```

For the fastest live target check, first identify a read-only tool whose invocation is safe, then run:

```sh
node bin/sledgewire.mjs smoke https://YOUR-PUBLIC-MCP-HOST/mcp TOOL_NAME --safe
```

Only assert `--safe` when you have independently verified the tool's action is safe. Sledgewire treats target descriptions as untrusted.

## Connect as an MCP client

From the cloned directory, start the stdio MCP server with `npm run mcp`. Discover its tools through your MCP client. Call `sledgewire.selfcheck` with `{}` for a free signed result, or `sledgewire.quote` with `{"intent":"preflight","endpoint":"https://YOUR-PUBLIC-MCP-HOST/mcp"}` for a request template. The full CLI and HTTP surfaces are in the [README](../README.md).

## Arena service

When the organizer's separate Arena Room is available, the Sledgewire seller daemon answers service requests there and verifies native credit transfers before paid execution. Prices are Smoke 3, Assay 8, Invoke 12, Fleet 20, Seal 25, and Gauntlet 35 credits. A production public MCP endpoint, if deployed, provides `/arena.md`, `/mcp`, `/public-key`, and free `sledgewire.trace` receipt evidence. Do not send credits until the live seller announces its exact Room payee and a signed quote for your request.
