---
name: caveman-review
description: >
  Compressed code review - one line per finding with location, problem and fix.
  Use whenever the user says /caveman-review, "review this PR", "review the
  diff", "check this code", or pastes code and asks what is wrong with it.
---

# caveman-review

One line per finding. Location, problem, fix. No throat-clearing.

## Format

`L<line>: <severity> <problem>. <fix>.`
Multi-file: `<file>:L<line>: ...`

Severity:
- `🔴 bug:` broken behavior, will cause incident
- `🟡 risk:` works but fragile (race, missing null check, swallowed error)
- `🔵 nit:` style, naming, micro-optim. Author can ignore
- `❓ q:` genuine question

Order: bugs, risks, questions, nits. No findings? Say `No issues.` and stop.

## Drop
- "I noticed that...", "It seems like...", "You might want to consider..."
- "Great work!" per comment. Once at top max
- Restating what the line does
- Hedging ("perhaps", "maybe"). Unsure? Use `q:`

## Keep
- Exact line numbers
- Exact symbol names in backticks
- Concrete fix, not "consider refactoring"
- The why, if the fix is not obvious

## Examples

Bad: "I noticed that on line 42 you're not checking if the user object is null before accessing the email property..."
Good: `L42: 🔴 bug: user can be null after .find(). Guard before .email.`

Good: `L88-140: 🔵 nit: 50-line fn does 4 things. Extract validate/normalize/persist.`
Good: `L23: 🟡 risk: no retry on 429. Wrap in withBackoff(3).`

## Security pass (always, every review)
- Tenant isolation: every query filtered by `org_id` from the session, never from request body/params. Missing → 🔴.
- AuthZ: role check on every write route, not just auth. IDOR on `/:id` routes → 🔴.
- Injection: raw SQL concat, `dangerouslySetInnerHTML`, shell exec with user input, unvalidated redirects → 🔴.
- SSRF: server fetches a user-supplied URL (LAIE scraping, webhooks) without allowlist → 🟡/🔴.
- Webhooks: Razorpay / Meta / Stripe signature verified before parsing? Idempotent on retries? Missing → 🔴.
- Secrets: hardcoded keys, `rzp_live_` in code, secrets in logs → 🔴.
- Input: Zod validation at every API boundary. Missing → 🟡.
- Rate limits on auth, OTP, send, and AI endpoints. Missing → 🟡.
- LLM calls: untrusted text wrapped as data; tool actions tenant-scoped (see `erix-ai-builder`).
- Tests: changed behavior without a test → 🟡.

Full audit or pen-test request → use `security-audit` skill instead.

## ECODrIx house rules - flag as 🔴 bug

- MongoDB, Supabase, Redis or BullMQ imported or added to package.json. Stack is Postgres on GCP Cloud SQL via Drizzle.
- Frontend (Next.js) calling backend with raw `fetch`/`axios` instead of `@ecodrix/erix-api` SDK.
- Raw SQL string concatenation instead of Drizzle query builder or `sql` template.
- Client data (PII, phone, email) logged, or sent to a service outside the org.
- Money as float. INR amounts must be integer paise or `numeric`.

## When to break terse mode
Security findings (injection, auth bypass, secret leak), architectural disagreements, onboarding a new dev. Write a normal paragraph, then resume one-liners.

## Boundaries
Review only. No code fix unless asked. No approve/request-changes. Output ready to paste into the PR.

---
Adapted for Claude.ai from JuliusBrussee/caveman (Apache-2.0).
