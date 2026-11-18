# Lessons

## Architecture

- **Nova USD wallet enforcement**: `company_nova_wallets` stores `limits_enabled`, `free_allowance_usd`, `purchased_credit_usd`, `spent_usd`, optional `model_tiers`. No doc or `limits_enabled=false` = unlimited. `assertNovaCredits` gates stream/confirm/route/multi/schedule before LLM; `402` + `NOVA_CREDIT_EXHAUSTED`. `recordUsage` resolves per-model Anthropic rates (`modelPricing.js`, Haiku 5.5 prompt threshold) then `$inc` spent. Admin: `GET/PUT …/wallet`, `POST …/wallet/credits`. Ops UI: agent-analytics company page.

- **Task-tier models**: `taskModels.js` resolves tiers from user prefs → company wallet `model_tiers` → env defaults. Only **daily + medium** are active (`ACTIVE_TASK_TIERS`); reports/shopify use medium. Hard/advanced reserved. ALS `taskModels` set in `runCoworkerTurn`. Wallets = agent Mongo; platform subscriptions = Laravel (not agent Mongo).

- **Per-request tenant context via AsyncLocalStorage**: `requestContextMiddleware` (mounted in `app.js` after `express.json`) binds `{companyId, userId, apiToken}` from the request body/headers into ALS for `/api/agents|tools|price-comparison|webhooks`. `resolveWorxstreamCredentials()` resolves per field: ALS → global session (`POST /session`) → env defaults. This makes concurrent multi-tenant requests safe; the global session is only a fallback.

- **The MCP server is dual-faced**: the in-process `toolRegistry` Map in `src/mcp/server.js` is the source of truth used by agents (`executeMcpTool`); external MCP clients connect via Streamable HTTP at `POST /mcp` (stateless: a fresh `createMcpServer()` + transport per request, since an SDK server binds to one transport). Never re-introduce a module-level connected `McpServer`.

- **Use zod v4's native `z.toJSONSchema` for tool schemas**: the old hand-rolled converter flattened nested objects/unions to `{type:'string'}`, hiding `filter.advance` structure from the model. Conversion is memoized per tool; strip `$schema`/top-level `additionalProperties` for Anthropic's `input_schema`.

- **Tool domains use ordered explicit rules, never substring guessing**: `DOMAIN_RULES` in `toolCapabilities.js` (first match wins, most specific first — e.g. `organization_contact`→company must precede `contact`). `BaseAgent.getTools()` never falls back to all tools — an empty domain bucket logs an error and returns `[]` (with tool search enabled, `[]` allowList would still leak all tools through BM25, so return a plain `[]`). Guarded by `test/context/agent-tool-domains.test.js`.

- **Agents can span multiple tool domains**: set `domains: ['a', 'b']` on the definition (e.g. finance = `['finance','config']`); `BaseAgent` unions the buckets. Prefer this over duplicating tools into a second domain.

- **Universal `resolve_entity` meta-tool for name→ID resolution**: every agent automatically gets the `lookup` domain bucket (`BaseAgent.getTools()` appends it), whose single `resolve_entity` tool resolves `{entity_type, query}`. For CRM/finance types in `GLOBAL_SEARCH_OBJECT_NAMES` it calls `global_search` first (one API → id + appId + name); otherwise (or on empty/error) it falls back to domain dropdown/list tools. Agents must NEVER ask the user for an internal ID — the global ID RESOLUTION prompt rule enforces this. Dispatch targets are test-guarded.

- **Nova `#` entity picks seed context without resolve_entity**: The web Nova composer typeahead (`#query` → `globalSearchService`) sends `entity_refs` on `POST /agents/stream`. `applyClientEntityRefs` merges them into Redis `entities`/`entityRefs` (with `source: 'client'`) and injects a `[Referenced records]` block even when `COWORKER_SCRAPE_ENTITY_IDS` is off. Agents must reuse those IDs and skip `resolve_entity` for the same records.

- **Cross-domain lookups via `extraTools`, not user prompts**: strict domain scoping broke prompts that assumed access to `get_customer_dropdown`/`get_team_members_dropdown` etc., so agents asked users for IDs they could look up themselves. Cherry-pick the few read-only lookup tools an agent needs via `extraTools: [...]` on its definition (good for tools its prompt names directly); for everything else `resolve_entity` covers it. Typos fail in `agent-tool-domains.test.js`.

- **Worxstream credentials from env/session**: `getWorxstreamContext()` and MCP tools use per-request ALS context first, then `POST /session` credentials, then `WORXSTREAM_API_TOKEN`, `DEFAULT_COMPANY_ID`, and `DEFAULT_USER_ID` from `.env`. Chat `companyId`/`userId` in the request body now scope both Mongo/Redis conversations AND Worxstream API calls.

- **Tool transcripts must survive the turn (Cursor-style memory)**: Mongo only stored user text + formatted assistant text, so the next turn's agent had NO idea which tools already ran — it repeated the same lookups and re-discovered the same API validation errors every turn. Fix: `persistConversation` stores a compact `tool_activity` array on each assistant message (tool, capped input, ok/error), and `normalizeStoredMessages` replays it as a `[Tools used this turn]` block in agent history.

- **Coworker working memory**: Redis `ConversationContext` includes `workingSet` (session goal, active task, pending clarification, lastOutcome, toolNotes) via `src/agents/workingMemory.js` — not only numeric IDs. Injected in `buildContextPrompt` as `[Session focus]`. `toolNotes` accumulates per-tool failure messages (e.g. "create_task: The issue type field is required", capped at 5) and clears each note when that tool succeeds — `lastOutcome` alone only remembered the final tool of a turn.

- **Unified pipeline**: All agent entry points should use `runCoworkerTurn` in `src/agents/coworkerPipeline.js` so Mongo history, Redis context, formatter, and summary stay consistent.

- **Cheaper conversation memory**: MongoDB stores UI turns; `/api/agents/stream` loads them each request. Router/Nova/general chat use `manageContextWindow` (full cap). Specialists get `SPECIALIST_CONTEXT_MESSAGES` recent turns via `_conversationHistory` in `BaseAgent`. Redis `ConversationContext` remains for canonical IDs — both layers together.

- **Hosted Valkey/Redis (e.g. DigitalOcean)**: Prefer `REDIS_HOST` + `REDIS_PORT` + `REDIS_USERNAME` + `REDIS_PASSWORD` (or a single `rediss://…` URL) in `.env`; `src/config/index.js` builds a TLS URL for port `25061` automatically. Never commit credentials.

- **Persist the UI-facing assistant text**: With formatter off, Mongo stores Nova's raw presentation text (same tags the live stream sent). If `formatOutput: true`, store the formatter return value — not a second unformatted draft.

- **Worxstream customer ids are 300-series**: `list_customers` rows may include a 200-series `id` (record/contact) and a separate master id (`customer_id` / `customerId`, e.g. `30000000037`). `get_customer_details` and Redis context must use the **300-series** id only. Do not copy example ids from prompts (e.g. `20000001109`).
- **Canonical ID slots beat “raw id”**: List/detail APIs often return `id`, but downstream tools require domain-specific slots like `customer_id`. Use `resolveCustomerRecordId()` in `ConversationContext.js` and match list rows by email/search before setting `customer_id`.
- **Context must be tenant-scoped**: Any shared context store (Redis) should key by `(company_id, user_id, conversation_id)` to avoid cross-tenant collisions and confusing follow-up behavior.

- **Workflow trees are embedded deterministically, never via the formatter LLM**: `runCoworkerTurn` captures the `get_workflow_object_tree` payload and appends `<workflow>{json}</workflow>` AFTER formatting (also streamed as a final text SSE event). Asking Haiku to copy a large JSON tree verbatim is unreliable and token-expensive; the formatter prompt explicitly forbids emitting `<workflow>` itself. The client extracts the tag in `Message.tsx` and renders it with React Flow (`WorkflowVisualization`).

## Gotchas

- **Stripe CLI `agent setup` may miss Cursor**: `stripe agent setup` often fails to detect Cursor even when `Cursor.app` is installed. Use `/add-plugin stripe` in Cursor chat, or manually: `npx skills add https://docs.stripe.com` (skills land in `.agents/skills/`) plus `"stripe": { "url": "https://mcp.stripe.com" }` in `~/.cursor/mcp.json`, then OAuth-connect MCP. Local webhooks: `stripe listen --forward-to localhost:<PORT>/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET` to the printed `whsec_…`.

- **Two Anthropic models (main + fast), no dated snapshots**: Agent/governance tool loops use `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`). Control calls use `ANTHROPIC_MODEL_FAST` / `config.anthropic.fastModel` (default `claude-haiku-4-5`): execution plan, router, nova plan, self-check, summary, general chat, formatter. Dated/retired IDs fall back per slot.

- **Worxstream HR endpoints require `user_id` even for dropdowns**: `/hr/team-members/dropdown-list` 400s with "User ID is required" when only `company_id` is sent. Always pass both from `getWorxstreamContext()` in HR tools.

- **Haiku wraps output in markdown code fences**: any Haiku call whose output is consumed programmatically (router JSON, Nova plan, formatter XML) MUST strip \`\`\` fences before parsing/rendering — and prompts should explicitly forbid fences. Sonnet rarely does this, so the bug only appears after switching a call to the fast model. Strips live in `router.js`, `coworkerPipeline.js` (`stripJsonCodeFence`), `OutputFormatter.js` (`stripCodeFence`), and `client/src/utils/parseXML.ts`.

## Performance

- **OutputFormatter is off by default**: Nova emits presentation tags directly; set `options.formatOutput: true` only when a second formatting pass is needed. Stream/route entry points pass `formatOutput: false`.
- **Control calls use fastModel with trimmed history**: router, execution plan, Nova plan, and self-check use `config.anthropic.fastModel` and only the last ~6 turns.
- **Skip Nova for single-agent routes**: when the router returns one agent, the plan is trivially `{mode:'single'}` — calling Nova to confirm it was a full wasted LLM round-trip on the most common path.
- **Parallelize turn pre-work**: Mongo history, Redis context, and user preferences are independent — `Promise.all` them in `runCoworkerTurn` instead of five sequential awaits. Emit a `status` SSE event immediately at turn start so the UI shows activity before any I/O completes.

## Date/Time

- **Inject current date/time into agent context**: Agents need the current date to resolve relative phrases like "last month", "this week", "last quarter". Use `getCurrentDateTimeContext()` from `src/utils/dateContext.js` and prepend it to system prompts (legacy chat) or conversation context (multi-agent flow).
- **Enforce list policies at runtime**: Apply shared behaviors in `BaseAgent` so prompts can’t drift: normalize date filters (`created_date` → `created_at`, BETWEEN arrays → `"from,to"`), paginate automatically for “all” requests (with a safe cap), and filter by status labels like Open/Paid without putting status into `filter.search`. Policies live in `src/agents/policies/listPolicies.js`.


## Frontend/Rex Dashboard

- **Rex dashboard component must exist**: The App.tsx imports `RexDashboard` from `./components/RexDashboard` and routes `/rex` to it, but the component file was missing. Always ensure imported components exist, especially for admin interfaces that might not be frequently accessed during development.

## Reports & Analytics

- **No export-csv MCP tools**: `/report/*/export-csv` APIs are dead — do not re-add `export_*_report_csv` tools. Users download via the chat UI Download report control; agents use `generate_*_report` for data.
- **Charts are MANDATORY for all reports**: The Reports Agent must ALWAYS generate visual charts for numerical data. Never present reports without charts, KPI cards, and visual elements. This is a hard requirement, not optional.
- **Minimum required elements**: Every report must include: 1) Executive summary, 2) KPI cards, 3) At least one chart, 4) Data table, 5) Trend indicators when applicable.
- **Use chart generation utilities for visual reports**: The Reports Agent should leverage `ChartGenerator` and `ReportAnalytics` utilities to create visual charts, KPI cards, and performance gauges. Use `generateMandatoryDashboard()` to ensure all required elements are present.
- **Reports require visual formatting**: When generating reports, use the extended XML tags (`<chart>`, `<gauge>`, `<trend>`) in the output formatter. Include executive summaries with key insights and actionable recommendations.
- **Chart types by data**: Bar charts for comparisons, line charts for trends, pie charts for distributions, multi-series for multiple metrics, gauges for goal progress, and trend indicators for period-over-period changes.
- **Charts require explicit XML generation**: Reports Agent MUST generate specific XML tags (`<chart>`, `<stats>`, `<gauge>`, `<trend>`) in raw output. The frontend parses these tags for visual rendering. Agent prompts must include chart XML examples to ensure proper generation.
- **Chart CSS requires valid variables**: Chart containers use `var(--bg-chat)` not `var(--bg-primary)` in CSS. All chart CSS variables must map to existing theme variables defined in index.css.
- **Use specific report tools not generic list tools**: Reports Agent should use `generate_estimate_report`/`generate_invoice_report` rather than `list_estimates`/`list_invoices` when generating reports. Only fall back to generic list tools if report endpoints return 404.
- **Context injection pattern**: Report tools get `companyId`/`userId` from `getWorxstreamContext()` and inject them into API calls as `company_id`/`user_id`, removing the need for agents to manually pass these parameters.
- **Data type conversion in MCP tools**: Agent parameters may come as strings, so MCP tools must convert them to proper types (Boolean for booleans, Number for numbers). Use explicit conversion: `Boolean(param)`, `Number(param)`.
- **Field name mapping**: API may expect different field names than tool parameters (e.g., tool uses `line_items` but API expects `lineItems`). Map field names in the tool implementation.
- **Report tools must hit the reports domain first**: tools like `generate_invoice_report` contain `invoice` — the reports special-case in `toolCapabilities.js` must stay ahead of all entity rules. (Domain rules themselves: see Architecture section.)
- **Agents use main model; control uses fastModel**: specialists/Nova/governance → `config.anthropic.model`; plan/router/summary/formatter → `config.anthropic.fastModel`.
- **Line item data must be explicitly requested**: Reports Agent should always use `line_items=true` parameter in report generation and include detailed product/service breakdowns, top performers, and margin analysis. Enhanced system prompt ensures comprehensive line item analysis with dedicated charts and tables.
- **Teach Nova what the UI can render, then let it choose**: the OutputFormatter is off by default, so the tag syntax lives in `responseStandard.js` (Markdown tables, `<stats>`, `<chart>`, `<alert>`) inside the shared rules; prescriptive per-answer layouts were removed in favour of principles (open with the answer, one representation per data set). Counting by status uses the report tools' status filter; paging through `list_*` and counting rows produced wrong, verbose answers. Keep SOUL.md and the shared rules lean (size is test-guarded) — they ship on every request.

- Tool descriptions state what the tool returns, when to use it versus its neighbours (e.g. list_sales_orders vs list_shipments) and which calls write data and need confirmation; web `apiEndpoints.ts` + services are the source of truth for endpoints.

- Money grants must be idempotent on the payment reference (webhooks retry): keep the credited refs on the wallet document and make the grant a single atomic update whose filter excludes an already-credited ref; a duplicate shows up as a unique-key error on the upsert, never as a second credit. History rows are best-effort and written after the balance changes.
- **Per-user services must use the caller's own token, never the fallback.** `getWorxstreamApiToken()` falls back to `WORXSTREAM_API_TOKEN` and the shared in-memory login session; for mail that silently meant "the server's identity", which has no mailboxes (empty list) or, worse, someone else's. Use `getRequestUserToken()` (the token the request itself carried) and make the web send it (`Authorization: Bearer`).
- **The planner decides before tools are considered.** It only knows what its own prompt says, so a new tool domain must be named there (and in `coworkerRules.js`) or the planner returns `clarify` ("which email platform?") and the tools are never used. `test/mail/mail-routing.test.js` fails when a mail tool is not mentioned in both.
- **Give the model short handles for long ids.** A 150-character provider id is easy to mis-copy and every message in a mailbox shares most of its prefix. Return a short `ref` next to it and accept either. Also never let an optional filter (the account address) turn a by-id lookup into "not found": the model often passes the account the user named, not the one the result is in.
- **A limit that is checked after the spend is not a limit.** A model reply's price is only known once it is written, so "stop when the cap is reached" overshoots by one call (and by much more on a long context). Bound the call BEFORE it runs: worst-case price = estimated input + max_tokens at the output rate, shrink max_tokens to fit, hold the credit atomically so concurrent requests cannot share it, and learn the real/estimated input ratio within the turn because the estimate is a heuristic. Any refusal must be handled by the caller (the agent loop ends the turn; optional calls like the self-check are skipped).
