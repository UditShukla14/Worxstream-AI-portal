# Future plan

Backlog for the Worxstream AI agent, in priority order within each group. Nothing here is started. Check `mindmap.md` before changing anything and update it afterwards.

## 1. Safety and trust
- [ ] **UI write approval.** Any write or destructive tool (`destructiveHint` / write capability) returns a pending action; the chat shows a confirm card with the exact action and the server refuses to run it until the user approves. Replaces the model-judged confirmation (e.g. `send_sms`).
- [ ] **Role-aware tools.** Filter and block tools by the signed-in user's role, so the agent never offers an action the API would reject.
- [ ] **Audit log of AI actions.** Per write: who, chat, tool, record, input, result, with an open-record link.
- [ ] **Prompt-injection hardening.** Treat Shopify, email and note content as untrusted data in tool results.
- [ ] **`/mcp` auth** (deferred earlier).

## 2. Quality and measurement
- [ ] **Eval suite.** 40-60 real questions checking tool choice, arguments and answer facts; run on every prompt, description or model change. Baseline the tool-description rewrite.
- [ ] **User feedback.** Thumbs up/down with a reason per answer, feeding the admin Quality page.
- [ ] **Rewrite the 29 specialist domain prompts** to the principle-based standard used for Nova.
- [ ] **Description pass for the ~114 short tool descriptions** (settings/admin CRUD) if evals show mis-selection.

## 3. Product features
- [ ] **File upload.** PDF or image of a vendor invoice, receipt or PO; read with Claude and draft a bill or PO for approval.
- [ ] **Links to records** (open in Worxstream) on every record the agent mentions.
- [ ] **Follow-up suggestion chips.**
- [ ] **User memory.** Persisted preferences (currency, report period, region).
- [ ] **Table export** (CSV/Excel per table) and chart actions.
- [ ] **Plan-step progress** ticking, **message edit**, **stop-flow standardisation** (deferred earlier).

## 4. Cost and reliability
- [ ] **Model routing.** Haiku for compaction, summaries and simple lookups; Sonnet/Opus for reasoning.
- [ ] **Per-company rate limits and spend-spike alerts** on top of the wallet. (Wallet itself is done: idempotent grants, history, trial, low-balance, mid-turn credit cap, see docs/wallet.md.)
- [ ] **Low-balance email/notification** to company admins (the flag exists; nothing sends it yet).
- [ ] **Estimate from real data:** derive `typical_request_usd` from the average charged cost per chat turn instead of a staff-set figure.
- [ ] **Monthly recurring Nova plans** (Stripe subscriptions) on top of the one-time credit purchases.
- [ ] **Refund / chargeback** removes credit by `payment_ref`.
- [ ] **Server-side compaction** (Anthropic beta) as an alternative to our summary pass.
- [ ] **Stream resume** after a dropped connection.
- [ ] **Idempotency keys on create tools** to prevent duplicate documents on retry.

## 5. Web mail page (`apps/web/src/pages/Mails`)
Done: HTML sanitising, remote-image blocking, `mailApiUrl()` helper, debug logs removed, popup poll timer moved to a ref, demo routes dev-only, the two lists merged into one `EmailList` (hook `useMailFolder`, `EmailRow`, `MailFilters`), mail backend auth fixed, socket `off()` leak fixed, one mail API client (`lib/api/mailClient.ts`, `mailApi.ts`, `mailAccounts.ts`) with tests, dead axios files removed.
- [x] Agent mail tools (read-only): unread summary, search, single message, overview, accounts.
- [ ] Agent mail writes (draft reply, send, mark read) behind the UI write-approval card (section 1).
- [ ] Email to record: create a task, deal note or estimate request from an email; customer card for the sender.
- [ ] Snooze/follow-up reminders, drafts, mailbox-wide search, keyboard shortcuts.
- [ ] Surface AI reply/compose token usage in the company wallet and usage tracking.
- [ ] Delete `utils/mailAgentUser.ts` (no longer referenced; it only built the ignored X-User-Info header).

## Decided against
- **TOON instead of JSON for tool results.** Savings only on flat lists and a risk to accuracy and truncation logic; revisit only if token cost becomes a problem.
