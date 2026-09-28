# AI Instructions: Startup Guardrails

These are standing directives for any AI assistant (Claude, Claude Code, etc.) working on this company's products. They apply regardless of which product in the suite you're touching. They are NOT about frontend or backend implementation — they are about the business-critical concerns that must be respected in every decision, doc, or piece of code you produce.

Follow these automatically. Don't wait to be asked.

---

## 1. Legal & Structure — Always Respect

- Never generate code, docs, or copy that implies a business entity, trademark, or legal status that hasn't been confirmed. If unsure of the company's registered structure, ask rather than assume.
- Any IP-relevant file you generate (contracts, licenses, README ownership notices) must assign ownership to the company, not to an individual, unless explicitly told otherwise.
- Flag anything that looks like it needs a founder agreement, vesting clause, or contractor IP assignment — don't draft legal terms yourself; recommend a lawyer review.

## 2. Privacy & Data Protection — Enforce on Every Feature

- Before building any feature that touches user data (forms, auth, analytics, storage), ask: **does this require a Privacy Policy update?** If yes, say so explicitly.
- Default assumption: this company operates out of Nigeria and may have EU/US users. Apply the strictest applicable standard among NDPA (Nigeria), GDPR (EU), and CCPA (California) unless told to scope narrower.
- Any new data field collected must map to a stated purpose. Do not add "just in case" data collection — flag it if a request implies this.
- iDevPay-related work: treat as PCI-DSS scope. Never store raw card data; always recommend a compliant processor/tokenization approach.
- Clinik-related work: treat as health-data scope. Apply the strictest reasonable standard even without a Nigerian HIPAA-equivalent.
- Always include: data retention period, deletion mechanism, and breach-notification path when scaffolding a new data-handling feature — don't leave these as "TODO."
- Cookie/tracking scripts require consent handling — flag if a request would add tracking without it.

## 3. Scalability — Check Before Committing to an Approach

- Before recommending an architecture, data model, or third-party service, state the cost/behavior at 1K, 10K, 100K, and 1M users. If you don't know, say so rather than assume it scales.
- Flag vendor lock-in risk explicitly when recommending Firebase/Supabase/AWS-specific features — note what the migration cost would look like.
- Don't silently choose a "quick and dirty" implementation for something that will hit real scale (billing, auth, messaging) without flagging the tradeoff.
- When designing shared infrastructure (iDevVault, billing rails, `aiComplete`), treat it as suite-wide dependency — a decision here affects all nine products, so call that out.

## 4. Security & Trust — Default-On, Not Opt-In

- Any public-facing endpoint or form should be treated as abuse-prone by default: mention rate limiting, input validation, and auth requirements even if not asked.
- When scaffolding a project, include a `SECURITY.md` / responsible-disclosure contact by default unless one already exists.
- Never hardcode API keys, secrets, or credentials in generated code — flag this proactively if a request would lead there (this was already flagged once for iDevFlow's Capacitor build; treat it as a standing rule, not a one-off).
- If a feature involves payments, health data, or auth, explicitly mention incident-response implications (who gets notified, how fast) rather than staying silent.

## 5. Finance & Business Logic

- When building pricing, billing, or subscription logic, confirm the monetization model before hardcoding assumptions (freemium vs. subscription vs. transaction fee).
- Don't invent financial projections or cap table numbers — these come from the founder, not from AI assistance.

## 6. Team & Process

- When generating onboarding docs, READMEs, or internal wikis, write them so a new hire (or a new product being spun up) doesn't need tribal knowledge to understand the system.
- Keep role/ownership assumptions out of generated docs unless confirmed — don't invent org structure.

## 7. Go-to-Market Awareness

- Don't optimize for vanity metrics in analytics/dashboards you build — default to activation, retention, and revenue-relevant metrics unless told otherwise.
- Any user-facing feature should include a feedback/bug-report path by default.

## 8. IPO / Long-Term Readiness

- Since the long-term goal is to take the company public, default to practices that hold up under due diligence: clean commit history, documented decisions, no shortcuts that would need to be unwound later (e.g., undocumented data sharing, missing consent flows).
- When in doubt between "fast and hacky" and "slightly slower but auditable," prefer auditable for anything touching money, health data, or user data.

---

### Priority Order When These Conflict With Speed
1. Privacy/data compliance (non-negotiable, blocks launch)
2. Security basics (auth, secrets, rate limiting)
3. Scalability cost-awareness (don't need to over-engineer, just don't paint into a corner)
4. Everything else can iterate post-launch
