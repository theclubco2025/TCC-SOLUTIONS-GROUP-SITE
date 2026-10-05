# TCC Solutions Group

TCCSG's front-end business development system: the site finds a business,
remembers how they got there, analyses how they operate, identifies technology
opportunities, calculates the economics, and — eventually — turns that anonymous
analysis into an attributable sales opportunity.

TCCSG is the parent entity; PlateHaven and NaviTap are products it owns. **The
partner system belongs to TCCSG** — it does not live inside, depend on, or share
credentials with any product.

## The spine

```
Visitor → Referral → Analysis → Lead → Opportunity → Customer → Revenue → Commission
          ^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
          built                  models exist, no logic yet (Phase 3+)
```

## Layout

```
public/          index.html, privacy.html, terms.html, assets/
                 Served VERBATIM. These back TCCSG's Twilio compliance profile
                 (legal name, CA entity no., address, phone). Do not port them
                 to React or "tidy" them.
app/             Next.js App Router
  analyze/       the Technology Opportunity Analysis
  [partnerSlug]/ partner referral entry point
  partners/      partner program + application form
  api/           analysis, applications, health
lib/
  attribution.ts     who introduced this visitor
  analysis/          config, sessions, roi, ai, results, availability
prisma/          schema + migrations
middleware.ts    issues the anonymous attribution id on referral links
```

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # ROI arithmetic + attribution + input sanitising
npm run typecheck
npm run build        # prisma generate && migrate && next build
```

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | To leave demo mode | TCCSG's **own** Neon Postgres. Never PlateHaven's. |
| `DATABASE_URL_UNPOOLED` | With the above | Neon's direct connection. Migrations cannot run over a pooler. |
| `ANTHROPIC_API_KEY` | To run the analysis | TCCSG's **own** Anthropic account. Never PlateHaven's or NaviTap's. |
| `NEXT_PUBLIC_SITE_URL` | No | Defaults to `https://tccsolutionsgroup.com`. Builds referral links and QR codes. |

**Vercel injects environment variables at build time.** Adding one does not
change the running deployment — it needs a redeploy. This has caught us twice.

Without `ANTHROPIC_API_KEY`, `lib/analysis/availability.ts` hides the analysis
entry points and offers the strategy call instead, so the homepage CTA never
leads to a flow that dies at the last step.

Without `DATABASE_URL` the app boots against an in-memory store seeded with
three partners (`lib/demo-store.ts`), so the system is demonstrable before
Postgres exists. Partner applications submitted in that mode are **not
retained**, and the form says so rather than showing a false confirmation.
`/api/health` reports which mode is live.

## How attribution works

The **database is the system of record, not the cookie.** The browser carries
only an opaque id (`tccsg_ref`); first and last touch are derived by querying
`ReferralSession` rows for that id. A visitor can arrive through a partner link,
leave, and come back directly a week later — the analysis still attributes to
that partner, because the attribution was never carried in the URL.

Two relationships run in parallel and must never be collapsed into one:

- **attribution** — which `Partner` introduced the prospect
- **ownership** — which `User` at TCCSG is responsible for selling to them

`Referral` rows are append-only and `Lead.firstTouchPartnerId` is write-once, so
a partner who made the introduction is still credited when the deal closes
months later. The commission rule is configuration
(`Organization.attributionRule`, default `FIRST_VERIFIED`), and each
`Commission` stores the rule it was calculated under.

Add `?attribution=1` to a referral link in demo mode to see what was recorded.

## How the analysis works

Twelve questions (`lib/analysis/config.ts`), four required, autosaving. Then an
**optional** numbers step. Then the report.

**The model never produces a number.** ROI arithmetic runs first in
`lib/analysis/roi.ts` from figures the owner typed, and the results are handed to
the model as fact it may explain but not recalculate. Missing inputs produce a
named gap, never an estimate. Money ranges come from `IMPLEMENTATION_RANGES` via
the complexity band the model picks — if the model emitted prices, changing them
later would leave old analyses contradicting new ones.

**The model is allowed to conclude that nothing needs building.** TCCSG sells
development, which is exactly why recommending it when it is not warranted would
make the assessment worthless.

Cost control, because the endpoint is public and unauthenticated: one model call
per session enforced by a status guard, validation before the call, rate limits
per address on both starts and completions, and `ANALYZING` written before the
call so a killed function can be retried rather than stranding someone.

## Deployment traps

Each of these cost a failed or wrong production deploy:

- **`middleware.ts` must use relative imports, not the `@/` alias.** Vercel's
  edge bundler does not resolve tsconfig path aliases when tracing middleware.
  `next build` passes; the *deploy* is then rejected.
- **`vercel.json` pins `framework: nextjs`.** The Vercel project predates this
  app and its dashboard preset is "Other" with output directory "`public` if it
  exists" — which builds Next, discards it, publishes `public/` as a static
  site, and *reports success*. Do not remove `vercel.json`.
- **A 200 on `/` does not mean your push shipped.** A failed deploy leaves the
  previous one serving. Check the commit's Vercel status.
- **The team is on the Hobby plan**, which caps function duration. The model
  call is budgeted to fit (`ANALYSIS_EFFORT`), and Hobby is also reserved for
  non-commercial use under Vercel's fair-use policy.
- `postcss.config.mjs` is deliberately empty — PostCSS searches upward and finds
  a stray Tailwind config in `C:\Users\thecl` that breaks local builds.

## Where this is going

Shipped: the domain model, partner program and application form, referral
attribution, and the full analysis — questionnaire, ROI, AI assessment, report.

Next (Phase 3): the bridge from analysis to sales. "Turn this into a plan"
captures contact details, creates or matches a `Lead` carrying the attribution,
opens an `Opportunity`, and records a consultation request. Then the internal
sales view, then the partner dashboard, then commissions on collected revenue.
The schema already supports all of it.
