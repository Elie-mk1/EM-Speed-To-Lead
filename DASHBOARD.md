# EM Growth: Lead Source Dashboard

One page that answers, in 10 seconds: **which lead source brings the cheapest booked calls?**

Part of the EM Speed-to-Lead Revenue Engine (n8n + GoHighLevel + Supabase).

## What it shows

1. **The answer in one sentence:** the cheapest source per booked call, and how many times more the most expensive one costs.
2. **One card per source** (Meta Ads, Website, Referral), cheapest first: cost per booked call (big), cost per lead, cost per show, spend. Sources are never added together.
3. **Funnel by source:** Leads → Qualified → Booked → Showed, with the % that made it from each step to the next.
4. **Speed and no-shows by source:** median minutes from opt-in to first reply (green if within the 5-minute promise), and no-show rate (amber above 30%).
5. **Controls:** last 7 / 30 / 90 days, and a switch to hide the sample data.

## How it works

```
n8n workflows ──► Supabase tables (em_leads, em_ad_spend)
                         │
                         ▼
          SQL function em_dashboard(from, to, include_demo)
                         │   (runs on the server only)
                         ▼
      Next.js server component ──► plain HTML to the browser
```

- All maths lives in **one SQL function**, `em_dashboard`, so the numbers are identical wherever they're read.
- The page is a **server component**: it calls the function on Vercel's server and sends finished HTML. No key, no raw lead data, and no API call is ever made from the browser.

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret** key |
| `DASHBOARD_USER`, `DASHBOARD_PASSWORD` | Optional. Set both to password-protect the page |

3. `npm run dev` → open http://localhost:3000

## Deploy (Vercel)

1. Push this folder to a GitHub repo (`.env.local` is git-ignored).
2. vercel.com → Add New → Project → import the repo.
3. Add the same environment variables in the project settings.
4. Deploy. The Vercel URL is the live dashboard.

## Decisions

- **Next.js on Vercel:** free hosting, and server components keep secrets off the browser by default.
- **One SQL function for every metric:** one place to check the maths; the page only formats.
- **Function locked to the service role:** the public anon key can't read it, even if leaked.
- **`server-only` on the data files:** the build fails if anyone ever imports them into browser code.
- **Cohort counting:** a lead counts in the period it signed up, so a booking is never matched with the wrong month's spend.
- **Cheapest source first, one sentence on top:** the owner gets the answer before reading a single chart.
- **Cost per booked call as the hero number:** that's the question the owner asked; per lead and per show are supporting.
- **Median (not average) time to first reply:** one slow outlier doesn't hide that most replies are fast.
- **"—" / "No bookings yet" instead of $0:** dividing by zero bookings isn't free, it's unknown.
- **No-show warning above 30%:** typical B2B call no-show rates sit around 20–30%, so above that needs attention.
- **Sample data flagged, switchable:** realistic history makes the page readable in a demo, and the toggle shows real data only.
- **Optional Basic Auth:** a simple lock without building accounts; off when the env vars are empty.
- **No chart library:** plain CSS bars keep the page fast and simple; nothing to configure.
