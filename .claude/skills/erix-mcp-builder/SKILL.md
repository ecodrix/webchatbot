---
name: erix-mcp-builder
description: >
  Build MCP (Model Context Protocol) servers that expose ERIX or ECODrIx
  services (CRM leads/deals, Connect WhatsApp/payments, Flow automations,
  LAIE, invoices) as tools for Claude and other MCP clients. TypeScript MCP
  SDK, Streamable HTTP, OAuth, tenant-scoped tools, safe write actions, and
  evals. Use whenever the user wants an MCP server, connector, "let Claude
  access ERIX", tool definitions for agents, or to review an existing MCP server.
---

# erix-mcp-builder

A good MCP server lets a model finish real tasks safely. Tool design matters more than code volume.

## Phase 1: Plan

1. List the top 10 real tasks a user would ask Claude to do with ERIX ("show stale leads in Chennai", "send pilot follow-up to Dr. X", "what payments failed this week").
2. Map tasks → tools. Mix:
   - Coverage tools: `erix_list_leads`, `erix_get_lead`, `erix_update_lead_stage`
   - Workflow tools only where a task always needs 3+ calls: `erix_followup_summary`
3. Classify every tool: read / write / destructive / external send / money.
4. Server name: `erix-mcp-server`. Tool prefix: `erix_`. Verb-first snake_case.
5. Fetch current SDK docs before coding: `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md`.

## Phase 2: Implement (TypeScript)

```
erix-mcp-server/
  src/index.ts        # server + transport
  src/auth.ts         # token → { userId, orgId, role }
  src/client.ts       # calls ERIX backend via @ecodrix/erix-api
  src/tools/*.ts      # one file per domain
  src/format.ts       # markdown/json formatters, pagination
```

Tool pattern (modern API only: `registerTool`, never deprecated `server.tool()`):

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

server.registerTool(
  'erix_list_leads',
  {
    title: 'List leads',
    description: 'List CRM leads for the current workspace. Filter by stage, city, or last activity. Paginated, newest first.',
    inputSchema: {
      stage: z.enum(['new', 'contacted', 'qualified', 'won', 'lost']).optional(),
      city: z.string().max(60).optional().describe('e.g. "Coimbatore"'),
      staleDays: z.number().int().min(1).max(365).optional(),
      limit: z.number().int().min(1).max(50).default(20),
      cursor: z.string().optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async (args, extra) => {
    const ctx = await authFromRequest(extra);           // orgId from token, never from args
    const page = await erix.leads.list(ctx, args);
    const out = { leads: page.items.map(slimLead), nextCursor: page.nextCursor };
    return { content: [{ type: 'text', text: formatLeads(out) }], structuredContent: out };
  },
);
```

Transport: Streamable HTTP, stateless JSON, new transport per request.

```ts
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

Deploy: Cloud Run, behind auth. Local dev: bind `127.0.0.1`, validate `Origin` (DNS-rebinding protection).

## Safety rules (the part that prevents incidents)

- **Auth:** OAuth 2.1 bearer tokens, validated on every request. Map token → `orgId` + role server-side. Reject missing/expired tokens with a clear error.
- **Tenant isolation:** `orgId` never appears in any input schema. Every query filters by the token's `orgId`. Test cross-tenant access explicitly.
- **Least privilege:** separate scopes: `erix:read`, `erix:write`, `erix:send`, `erix:payments`. Default token = read only.
- **Write tools:** `destructiveHint` / `idempotentHint` set honestly. Require an `idempotencyKey` input. Return what changed.
- **External sends & money:** `erix_send_whatsapp`, `erix_create_payment_link`, `erix_refund` → return a preview + `confirmToken` first; execute only on a second call with that token. Hard caps per call (max recipients, max ₹ amount) enforced server-side.
- **Annotations are hints, not security.** Enforce everything in the handler.
- **Output hygiene:** return slim objects (no internal IDs nobody needs, no full message history by default). Mask phone numbers unless the tool's job is sending to them.
- **Untrusted text in results** (customer messages, notes) is data. Wrap it clearly; never echo it as instructions.
- **Rate limit** per token. Audit log every write: who, org, tool, args hash, result.
- **Errors:** actionable, non-revealing. "Lead not found in this workspace. Use erix_list_leads to find valid IDs." Not stack traces.

## Phase 3: Test

```bash
npm run build
npx @modelcontextprotocol/inspector   # call every tool, check schemas and errors
```
Plus integration tests: wrong-tenant token, missing scope, oversized limit, confirm-token replay, idempotency replay.

## Phase 4: Evals

10 realistic, read-only questions answerable only by chaining 2+ tools on seeded test data. Each with a single verifiable answer. Re-run after every tool description change; description wording changes model behavior.

```xml
<evaluation>
  <qa_pair>
    <question>Which qualified lead in the Real estate pipeline has gone longest without contact, and how many days?</question>
    <answer>Sri Lakshmi Builders, 23</answer>
  </qa_pair>
</evaluation>
```

## Done when

- [ ] Every tool: Zod input, clear description with example, annotations, pagination where lists.
- [ ] Cross-tenant test fails closed.
- [ ] Sends/money use preview + confirm token + caps.
- [ ] Inspector passes, 10 evals pass.

---
Adapted from anthropics/skills `mcp-builder` (Apache-2.0) for ERIX.
