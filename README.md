# EM Speed-to-Lead Revenue Engine

**n8n + GoHighLevel + Supabase + Gemini + Next.js (built with Claude Code)**

A B2B agency's leads come from Meta ads, the website and referrals. This system replies within a minute, qualifies each lead with AI, sends qualified leads a booking link, tracks every booking, reschedule, cancel, show and no-show, chases no-shows, stops the moment a human replies, alerts on every failure, and shows the owner which source buys the cheapest booked call.

## Live links

| What | Link |
|---|---|
| Dashboard | https://em-speed-to-lead.vercel.app/ |
| Booking page (GHL calendar `EM-Strategy Call`) | https://api.leadconnectorhq.com/widget/booking/i6Yov0aerfYXiBzSNAjJ |
| Lead intake webhooks (POST JSON) | `https://n8ndemo.remotelyx.com/webhook/em-stl-lead-meta` · `…/em-stl-lead-website` · `…/em-stl-lead-referral` |

## How it works

```
 Meta (simulated) ─┐
 Website form ─────┼─► EM-01 Lead Intake (n8n)
 Referral form ────┘      clean → dedupe → save (Supabase) → AI score (Gemini) → email (Gmail)
                                                   │
                       Qualified: booking link ────┘   Others: polite reply
                                   │
                    Lead books on the GHL calendar
                                   │
   GHL workflows (Booked / Cancelled / Showed / No-Show) ─► move the deal stage in GHL
                                   │                         + send the event to n8n
                                   ▼
                 EM-02 Appointment Events (n8n) → Supabase → no-show re-book emails
                 GHL calendar → reminders 24 h and 1 h before the call

 EM-03 Inbox Watch: lead or staff reply → pause automation; bounce → alert
 EM-04 Error Alerts: any failed node in any workflow → email + log
 Dashboard (Vercel) → reads one SQL function in Supabase → cost per booked call by source
```

### The 4 n8n workflows (exported JSON submitted with the project)

| Workflow | Job |
|---|---|
| `EM-01 Lead Intake` | 3 webhooks → normalize to one shape → dedupe → save → Gemini score → status → first email (send-once) → record reply time |
| `EM-02 Appointment Events` | Receives GHL appointment events → dedupe → update lead stage and timestamps → no-show re-book sequence (3 emails) |
| `EM-03 Inbox Watch` | Watches the agency inbox and sent folder → pauses a lead on any human reply, alerts on bounces |
| `EM-04 Error Alerts` | Error workflow for EM-01/02/03 → emails the failure, then logs it |

### GHL setup (all prefixed `EM-`)

- Pipeline `EM-Speed to Lead`: New → Qualified → Needs Review → Not Qualified → Booked → Showed → No-Show → Cancelled → Won → Lost
- Calendar `EM-Strategy Call` (30 min) with email reminders 24 h and 1 h before
- Workflows (folder `EM-Speed to Lead`): `EM-Appt Booked`, `EM-Appt Cancelled`, `EM-Appt Showed`, `EM-Appt No-Show`
- Custom fields (folder `EM-Speed to Lead`): lead_source, ai_status, ai_score, ai_reason, company_size, monthly_budget, timeline, automation_paused

### Supabase tables

`em_leads` (one row per lead, all timestamps) · `em_events` (dedupe keys) · `em_appointments` · `em_messages` (one row per email, send-once) · `em_ad_spend` (the ad spend sheet) · `em_errors` · function `em_dashboard()`

## Ideal client (used by the AI)

B2B company with 10–200 employees, monthly marketing budget of $3,000 or more, contact is a decision-maker (founder, CEO, owner, head/VP/director of marketing, sales or growth), wants to start within 90 days.
Red flags: student, job seeker, someone selling to us, budget under $1,000, B2C or personal project, spam.

## Hard cases and how each is handled

| Case | How |
|---|---|
| Same lead event arrives 3 times | Each event has a unique key (`meta:<leadgen_id>`, `website:<submission_id>`); the database refuses the 2nd and 3rd insert, so the flow stops |
| Nobody gets the same message twice | Every email first claims a row in `em_messages` with a unique `(lead, message_key)`; a second claim returns nothing, so nothing is sent |
| Same appointment event arrives again | Key `appt:<id>:<status>:<start time>` is deduplicated the same way |
| Reschedule | Same appointment ID with a new start time is a new key: the time updates and `reschedule_count` +1; GHL moves its reminders to the new time |
| Cancel kills old reminders | GHL only sends calendar reminders for confirmed/unconfirmed appointments, so a cancelled one gets none |
| Rebooked no-show keeps getting chased | Before every re-book email the database checks the lead is still `No-Show` and not paused; a rebook moves them to `Booked`, so the next email is skipped |
| A human reply stops all automation | Any email from a lead into the agency inbox, or a manual `Re:` reply from staff, sets `automation_paused`; every follow-up checks it first; the owner gets an email |
| Email bounces | Bounce notices in the agency inbox mark the message `failed`, log it and email an alert |
| AI fails or answers nonsense | Lead goes to **Needs Review** (score 50), never a guess |
| Invalid or missing email | **Needs Review**, no email attempted |
| Any node fails anywhere | `EM-04` emails the workflow, node, error and a link to the run, then logs it |
| Booking from an unknown email | Recorded in GHL but not counted by source (no matching lead) instead of guessing |

## Decisions (one line each)

**Architecture**
- Supabase is the single source of truth, so dashboard numbers never depend on GHL's reporting.
- Used the Postgres node over the Supabase node because dedupe and send-once need atomic SQL (`ON CONFLICT DO NOTHING RETURNING`).
- One `Lead In` merge point after the 3 webhooks, so everything after intake is built once, not three times.
- Meta is simulated with Meta Lead Ads' real `field_data` payload shape, so a real ad account could be plugged in later.
- Webhook paths are namespaced `em-stl-…` because paths are shared by everyone on the n8n server.

**Qualification**
- Gemini Flash (free tier) at temperature 0, so the same lead always gets the same score.
- The AI only gives a score and reason; code assigns the label (70+ Qualified, 40–69 Needs Review, under 40 Not Qualified), so the rules are fixed and testable.
- AI failure falls back to Needs Review with score 50: a human decides, the system never guesses.

**Messaging**
- Email only: free, and testable safely with Gmail plus-addresses that all land in my own inbox.
- Sent through Gmail in n8n because the sandbox GHL token has no conversations scope.
- A separate agency Gmail sends everything, so lead replies are distinguishable from agency mail.
- Booking links are pre-filled with name and email, so leads don't retype them and bookings match the lead.
- Three different replies (booking link / "we're reviewing" / polite decline), so nobody is left without an answer.
- Removed the n8n footer and SMS consent boxes: email-only, and it should read like the agency wrote it.

**GoHighLevel**
- The sandbox token is read-only and the Inbound Webhook trigger is premium, so GHL is written to only by GHL itself: the booking widget creates the contact and free workflow triggers move the deal.
- A server can't submit GHL forms (Cloudflare Turnstile), and I didn't try to bypass that.
- One GHL workflow per appointment event, grouped in an `EM-` folder: easier to debug than one branched workflow.
- `Create or Update Opportunity` because one action covers both a first booking and a rebook (would move to the new split actions in production).
- "Allow move to previous stage" on, so a no-show who rebooks goes back to Booked; duplicates off, so there's one deal per contact.
- Phone is optional on the booking form: we only use email, and fewer fields mean more bookings.
- Calendar reminders (24 h + 1 h, email) use GHL's built-in reminders, which move on reschedule and stop on cancel by themselves.

**Appointments and follow-up**
- GHL sends the start time without a timezone, so n8n converts it with the booking's timezone and stores UTC.
- No-show re-book sequence: right away, +1 day, +2 days, then stop: persistent but not spammy.
- Wait nodes plus a database check before each send, so a stale wait can never send to someone who rebooked or replied.
- Staff replies are detected as Sent emails with a `Re:` subject, because automated emails never use one.

**Reliability**
- One error workflow attached to every workflow, so failures can't be silent.
- The alert email is sent before the database log, so a database outage still alerts.
- Malformed events throw on purpose, so they trigger an alert instead of passing quietly.
- Retry on fail (3×) on Gemini and Gmail calls to ride out short outages.

**Dashboard**
- Next.js on Vercel's free tier, built with Claude Code; server components keep secrets off the browser.
- All metrics come from one SQL function, `em_dashboard()`, so the maths lives in one checkable place.
- Sources are never blended: one card, one funnel and one row per source.
- Cost per booked call is the hero number because that's the owner's question; a one-sentence answer sits on top.
- A lead counts in the period it signed up, so bookings aren't matched to the wrong period's spend.
- Median (not average) time to first reply, so one outlier doesn't hide the typical speed.
- "No bookings yet" instead of $0 when dividing by zero.
- Ad spend: Meta about $92/day, website SEO retainer + tools $1,590/month, referral partner rewards $600/month (`em_ad_spend.csv`).
- 30 days of realistic sample history (flagged `is_demo`, `@example.com`, never emailed) with an on/off switch.
- `supabase/em_refresh_demo_dates.sql` moves the sample history forward to end yesterday, so "Last 30 days" always has data in a demo.
- Light/dark switch that follows the viewer's system setting by default and remembers their choice in their own browser.

**Security**
- All secrets live in n8n credentials or Vercel environment variables, never in nodes, code, the repo, screenshots or the Loom.
- The dashboard uses Supabase's new revocable secret key, server-side only.
- `em_dashboard()` is revoked from the public/anon roles; every table has row-level security with no public policies.
- `server-only` imports make the build fail if the data code is ever pulled into the browser.
- Supabase connection ignores SSL verification because the n8n host doesn't trust Supabase's CA; traffic is still encrypted.
- Made-up data only; all test emails go to my own plus-addresses.

## Known limitations (honest)

- **GHL source tags and AI fields aren't written to the GHL contact.** The sandbox token can't write and the free routes are blocked (see GHL decisions). Every lead's source, AI status, score and reason are stored in Supabase and shown on the dashboard. With a write-scoped token, one HTTP node in EM-01 would sync them.
- **GHL deals start at booking, not at opt-in,** for the same reason; Qualified/Needs Review/Not Qualified stages are tracked in Supabase.
- **Gmail OAuth in "testing" mode expires every 7 days;** in production the Google app would be published.

## Run it yourself

1. Supabase: run `supabase/em_schema.sql`, then `supabase/em_dashboard_setup.sql` (the ad spend sheet is also in `supabase/em_ad_spend.csv`). Before a demo, run `supabase/em_refresh_demo_dates.sql` so the sample data covers the last 30 days.
2. n8n: import the 4 exported workflow JSON files (submitted with the project), then create credentials `EM-Supabase` (Postgres), `EM-Gemini`, `EM-Gmail`, and set EM-04 as the error workflow of EM-01/02/03.
3. GHL: create the pipeline, calendar and 4 appointment workflows above; point their Webhook action to `…/webhook/em-appointment`.
4. Dashboard: see `DASHBOARD.md` (deploy on Vercel with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
5. Send a test lead:

```bash
curl -X POST https://n8ndemo.remotelyx.com/webhook/em-stl-lead-referral \
  -H "Content-Type: application/json" \
  -d '{"submission_id":"REF-DEMO-1","name":"Lina Saab","email":"you+ref1@gmail.com","company":"Bluepeak Consulting","role":"CEO","company_size":"35","monthly_budget":"8000","service":"Full-funnel marketing","timeline":"ASAP"}'
```
