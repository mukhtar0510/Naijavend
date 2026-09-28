---
name: advanced-backend
description: Advanced backend engineering checklist for Supabase (Postgres/Auth/Edge Functions) + Vercel stacks — schema design, RLS security, API design, performance, and observability, past what AI tools default to.
---

# Advanced Backend Skill (Supabase + Vercel stack)

Companion to the frontend anti-vibecoded skill. Where that one stops generic UI, this one stops the backend problems that don't show up until real users, real load, or a security review hit the app: permissive RLS, unindexed queries, no idempotency, silent failures.

## Database & schema design

1. Every table gets a primary key that isn't just an auto-increment int if the table is ever exposed via a public API — prefer `uuid` (via `gen_random_uuid()`) so IDs aren't enumerable.
2. Add `created_at` / `updated_at` timestamps (`timestamptz`, not `timestamp`) to every table by default — you will need them for debugging even if no feature asks for them yet.
3. Use `NOT NULL` and `DEFAULT` deliberately on every column — don't leave columns nullable just because the ORM/migration tool made that the path of least resistance.
4. Watch for nullable string columns left as actual `NULL` after direct/bulk inserts (e.g. into `auth.users`) — decide up front whether empty string or `NULL` is canonical, and enforce it with a `DEFAULT ''` or a post-insert `UPDATE`, not ad hoc per-insert fixes.
5. Normalize to 3NF by default; only denormalize (duplicate data, JSON blobs) for a measured performance reason, and comment why in the migration.
6. Prefer `jsonb` over `json` for any column you'll ever query into.
7. Add foreign keys with explicit `ON DELETE` behavior (`CASCADE`, `RESTRICT`, `SET NULL`) — don't leave it at the default and discover the behavior in production.
8. Add check constraints for invariants the app logic assumes (e.g. `price >= 0`, `status IN (...)`) — don't rely on application code alone to enforce them.
9. Every foreign key column gets an index — Postgres doesn't add one automatically.
10. Add indexes for every column used in a `WHERE`, `ORDER BY`, or `JOIN` in a hot path — verify with `EXPLAIN ANALYZE`, not assumption.
11. Use partial indexes for queries that always filter on a status/flag (e.g. `WHERE deleted_at IS NULL`) instead of a full index.
12. Keep migrations additive and reversible where possible — avoid destructive `ALTER`/`DROP` in the same migration as new feature code; separate and stage them.
13. Never edit a migration file that's already been applied to any shared environment — write a new migration instead.
14. Name migrations descriptively with intent, not just a timestamp — future-you (or an AI agent) needs to know what each one does without opening it.

## Row Level Security & auth (Supabase-specific)

15. Enable RLS on every table by default the moment it's created — an exposed table with RLS off is a full data leak via the anon key, not a theoretical risk.
16. Write explicit policies per operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) — don't assume one `FOR ALL` policy covers intent correctly for each verb.
17. Tables like `public.admins` need an explicit `FOR SELECT` policy even for authenticated admin users — RLS defaults to deny, so a missing policy silently returns empty results, not an error, which is easy to misdiagnose.
18. Test RLS policies as each real role (anon, authenticated non-admin, authenticated admin) — not just as the service role, which bypasses RLS entirely and will hide bugs.
19. Never use the `service_role` key in any client-side code, including edge functions callable directly from the browser — it bypasses RLS completely.
20. Scope policies to `auth.uid()` comparisons, not to values passed in from the client that the client could forge.
21. For multi-tenant data, filter by tenant/org ID in the policy itself, not just in application-layer queries — the policy is the actual security boundary.
22. Use Postgres roles/grants alongside RLS for defense in depth — RLS alone is your only guard if it's misconfigured.
23. When debugging unexpected auth failures (e.g. GoTrue errors), check Supabase's log source `auth_logs` via query_logs before guessing — it's faster than trial-and-error on client code.
24. Rotate and scope API keys per environment (dev/staging/prod) — don't reuse one Supabase project's keys across environments.
25. Verify JWT expiry and refresh flow is actually exercised in testing, not just the happy-path login.

## API & Edge Function design

26. Validate every input at the edge function boundary (types, ranges, required fields) — don't trust the client, even your own frontend.
27. Return consistent error shapes across all endpoints (e.g. `{ error: { code, message } }`) — mixed error formats make client-side handling fragile.
28. Use proper HTTP status codes (400 vs 401 vs 403 vs 404 vs 409 vs 422 vs 500) — don't collapse every failure to 200 with an error field or every failure to 500.
29. Make mutating endpoints idempotent where possible (e.g. accept an idempotency key on payment/order creation) so retries from flaky networks don't double-write.
30. Rate-limit any public-facing endpoint that writes data or calls an LLM/paid API — unbounded edge functions are an open cost/abuse vector.
31. Keep edge functions small and single-purpose — a function handling five unrelated concerns is hard to secure, test, and reason about.
32. Never log full request bodies containing secrets, tokens, or PII — scrub before logging.
33. Set explicit timeouts on any outbound call (LLM API, third-party webhook) inside an edge function — an unbounded call can hang the function and burn quota.
34. Version your API surface (path or header) once external consumers exist, so you can change shape without breaking them.
35. Document required environment variables per function/deploy target — don't let "it works on my machine" hide an undocumented env var.

## Performance & scaling

36. Paginate every list endpoint from day one — "we'll add pagination later" is how a 10-row table becomes a 500ms query at 10k rows.
37. Avoid N+1 query patterns — batch or join instead of looping a query per row in application code.
38. Cache read-heavy, rarely-changing data (e.g. product catalog) at an appropriate layer — don't hit Postgres for the same unchanged query on every request.
39. Use connection pooling (Supabase's pooler / pgbouncer mode) for serverless/edge functions — direct connections exhaust Postgres's connection limit fast under concurrent invocations.
40. Profile slow queries with `EXPLAIN ANALYZE` before adding indexes blindly — an index you don't need adds write overhead for no read benefit.
41. Set sane `LIMIT`s as a safety net on any query that could theoretically return unbounded rows, even if the UI paginates.
42. Batch bulk writes/inserts instead of looping single-row inserts across many round trips.
43. Watch for edge function cold starts on latency-sensitive paths — bundle size and unnecessary imports both affect this.

## Security hardening

44. Treat every user-supplied string used in a query, file path, or shell command as untrusted — use parameterized queries, never string-concatenated SQL.
45. Store secrets in environment variables / secret managers, never committed to the repo, including in `.env.example` with real-looking values.
46. Set CORS explicitly per function to only the origins that should call it — don't leave it wide open by default.
47. Sanitize/validate file uploads (type, size, content) before storing — don't trust the client-reported MIME type.
48. Hash passwords only via the auth provider's built-in mechanism (e.g. Supabase Auth) — never roll your own password storage.
49. Audit third-party npm/edge function dependencies for known vulnerabilities before shipping, especially anything with filesystem or network access.
50. Ensure webhook endpoints verify signatures (Stripe, GitHub, etc.) before trusting the payload — an unauthenticated webhook is a forgeable trigger.
51. Don't expose internal error stack traces or DB error messages to the client in production responses — log them server-side, return a generic message.

## Observability & error handling

52. Every edge function/API route should log enough context (request ID, user ID if available, operation) to trace a failure after the fact.
53. Distinguish expected errors (validation failure, not-found) from unexpected ones (DB down, unhandled exception) in both logging and alerting — don't page on every 404.
54. Set up basic uptime/error-rate monitoring before launch, not after the first incident.
55. Wrap external API calls (LLM providers, payment processors) in try/catch with a defined fallback or user-facing message — don't let an unhandled rejection crash the whole request.
56. Surface meaningful error messages back to the frontend so it can show the interface's actual voice (see frontend skill) — a raw Postgres error string is not a UX.

## Testing & deployment

57. Write at least one test per RLS policy verifying both the allow and deny case — policies are exactly the kind of logic that silently regresses.
58. Test migrations against a copy of production-shaped data before applying to production, not just against an empty dev DB.
59. Keep staging and production Supabase projects fully separate (different project refs) — never test against prod data.
60. Automate deploys (Vercel + Supabase migrations) through CI rather than manual dashboard changes, so schema and code stay in sync and are reviewable.
61. Have a rollback plan for every migration that changes existing data shape, not just new-table migrations.
