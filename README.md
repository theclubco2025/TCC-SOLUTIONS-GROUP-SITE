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
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
          built (Phase 1-3)                                models exist, no logic yet
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
| `ADMIN_TOKEN` | For `/masteradmin` | A random secret, 32+ characters. Unset or short = nobody can log in (fails closed). Production only, marked sensitive. |
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

## From analysis to lead (Phase 3)

The report ends with "Turn this into a plan". Submitting it (`lib/sales/leads.ts`)
is the moment an anonymous analysis becomes a person:

- **Attribution is read on the server**, from stored referral sessions, never from
  anything the browser sends. There is no field a visitor or partner could use to
  claim credit.
- **First touch is write-once.** A later partner moves last touch and nothing else.
- **One person is one lead**, matched on lowercased email. A second analysis from
  the same owner updates the lead and adds an opportunity.
- **One analysis is one opportunity.** Submitting twice returns what exists.
- **`consultationRequestedAt` is a request**, not a held consultation. Choosing a
  time in Calendly is what books the call.
- **No sales owner is assigned.** Who works a lead is a human decision.

Read leads in the admin console (`/masteradmin/leads`). To check the raw rows
directly, in the Neon SQL editor:

```sql
select l."createdAt", l."businessName", l."contactName", l.email, l.phone,
       fp.name as "introducedBy", lp.name as "lastTouch",
       o.name as opportunity, o.stage, l."consultationRequestedAt"
from leads l
left join partners fp on fp.id = l."firstTouchPartnerId"
left join partners lp on lp.id = l."lastTouchPartnerId"
left join opportunities o on o."leadId" = l.id
order by l."createdAt" desc;
```

Each lead's full report is at `/analyze/<publicId>/results`; the public id is on
`analysis_sessions` (`publicId`), linked from `opportunities."analysisSessionId"`.

## The admin console: `/masteradmin`

Everything in the database, in one place, behind a login: an overview funnel,
leads (with the full analysis, the answers, who introduced them and the history),
partner applications, partners, every analysis including failed ones, and an
activity log. It can reply, change statuses, approve an application into a
partner, and create or pause partners.

**It is a single shared secret, not user accounts** — the right size for one
operator and the wrong size for a sales team. When reps need their own logins,
`lib/admin/auth.ts` is the only file that has to change.

- Log in with `ADMIN_TOKEN`. The browser then holds a signed 12-hour session in an
  httpOnly, SameSite=Strict, Secure cookie scoped to `/masteradmin`, never the
  token itself.
- **Every page and every server action calls `requireAdmin()`.** A layout is not
  enough (it does not re-run on client navigation) and a server action is a public
  POST endpoint that never renders a page. Do not add an admin action without it.
- Login is throttled to 5 failures per address per 15 minutes, held in the activity
  table so it survives serverless instances. Every attempt shows on the Activity page.
- **Rotating the token** (do this if it is ever exposed): set a new `ADMIN_TOKEN` in
  Vercel and redeploy. Every outstanding session dies at once, because sessions are
  signed with a key derived from it.
- Responses under `/masteradmin` are `no-store`, `noindex`, `no-referrer` and
  `X-Frame-Options: DENY`, set in `next.config.ts`.
- **There is no email sending.** "Reply" opens your own mail client with the message
  started, which is also what the recipient expects from a person.
- Each section loads independently and shows its own error in place, so one bad
  query cannot blank the console.
- **Search** (the box in the admin bar) looks across leads, applications, partners
  and analyses: names, emails, phones, partner slugs, the business name inside an
  analysis, or a report id pasted from a link. Every term goes through a Prisma
  filter as a bound parameter; no SQL is built from it.
- Statuses are colour-coded everywhere (blue new, amber in progress, green good,
  red ended), leads can be filtered by status, and a lead moves between statuses
  with one click.

## How the app pages look

They are built from the marketing page's own parts, not a separate style: black
and white only, the plain eyebrow, mono step numbers, 7px tags, the left-rule
pull quote, 1px-gap grids, and the hero's terminal box (`> AI`). Where a visitor
is shows as a terminal path beside the logo (`> analysis`, `> partners`,
`> report`), set by `<SiteShell area="...">` in `components/SiteChrome.tsx`. A
picked answer inverts to white, like the selected word in the hero box, and the
wait while a report is written prints its steps in that same box. Styles live in
`app/areas.css`.

Colour appears only in the admin, which is tinted navy with a blue rule so it is
never mistaken for the public site, and where a status colour carries meaning.

## The questionnaire experience

The questions themselves, and how answers are stored, are in `QUESTIONNAIRE` in
`lib/analysis/config.ts`. The order they are *shown* in, one per screen, is
`FLOW` in the same file, so the experience can be reworked without touching the
stored data or the model prompt. `lib/analysis/flow.test.ts` fails if a question
is left out of the flow, or if a question's id or type changes without
`QUESTIONNAIRE_VERSION` being bumped. Tap-to-fill `suggestions` only ever write
plain text into the answer box.

Answers save as the visitor types, and again with a `keepalive` request when the
page is hidden or closed. The numbers step recalculates as they type using the
same arithmetic as the report (`lib/analysis/roi.ts`).

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

Next: per-person logins for sales reps, then the partner dashboard, then
commissions on collected revenue. The schema already supports all of it.
