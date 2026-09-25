# TCC Solutions Group

The TCCSG site and the partner / referral system. TCCSG is the parent entity;
PlateHaven and NaviTap are products it owns. **The partner system belongs to
TCCSG** — it does not live inside, depend on, or share credentials with any
product.

## Layout

```
public/          index.html, privacy.html, terms.html, assets/
                 Served VERBATIM. These back TCCSG's Twilio compliance profile
                 (legal name, CA entity no., address, phone). Do not port them
                 to React or "tidy" them.
app/             Next.js App Router — /partners, /partners/apply,
                 /{partnerSlug}/analyze, /api/*
lib/             attribution, database access, demo store, slug rules
prisma/          schema + migrations
middleware.ts    issues the anonymous attribution id on referral links
```

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build        # prisma generate && next build
```

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | To leave demo mode | TCCSG's **own** Postgres. Never PlateHaven's. |
| `NEXT_PUBLIC_SITE_URL` | No | Defaults to `https://tccsolutionsgroup.com`. Builds referral links and QR codes. |

**Demo mode:** with no `DATABASE_URL` the app boots against an in-memory store
(`lib/demo-store.ts`) seeded with three partners, so the system is demonstrable
before Postgres exists. It resets when the serverless instance recycles, so
partner applications submitted in demo mode are **not retained** — the form says
so to the applicant rather than showing a success screen that isn't true.

`/api/health` reports which mode is live.

Once a database exists:

```bash
npx prisma migrate deploy
```

## How attribution works

The **database is the system of record, not the cookie.** The browser carries
only an opaque id (`tccsg_ref`); first and last touch are derived by querying
`ReferralSession` rows for that id.

Two relationships run in parallel and must never be collapsed into one:

- **attribution** — which `Partner` introduced the prospect
- **ownership** — which `User` at TCCSG is responsible for selling to them

`Referral` rows are append-only and `Lead.firstTouchPartnerId` is write-once, so
a partner who made the introduction is still credited when the deal closes
months later. The commission rule is configuration
(`Organization.attributionRule`, default `FIRST_VERIFIED`), and each
`Commission` stores the rule it was calculated under.

Add `?attribution=1` to a referral link in demo mode to see what was recorded.

## Deployment traps

Both of these cost a failed production deploy on 2026-09-24:

- **`middleware.ts` must use relative imports, not the `@/` alias.** Vercel's
  edge bundler does not resolve tsconfig path aliases when tracing middleware.
  `next build` passes; the *deploy* is then rejected.
- **`vercel.json` pins `framework: nextjs`.** The Vercel project predates this
  app and its dashboard preset is "Other" with output directory "`public` if it
  exists" — which builds Next, discards it, publishes `public/` as a static
  site, and *reports success*. Do not remove `vercel.json`.

A push to `main` is the production release. A 200 on `/` does **not** mean your
push shipped — check the commit's Vercel status.

## Where this is going

Shipped: the domain model, `/partners`, the application form, and referral
attribution.

Next: the Analyze questionnaire, then partner login and a per-partner dashboard
with analytics, then the admin side (leads, pipeline, commissions). The schema
already supports all of it.
