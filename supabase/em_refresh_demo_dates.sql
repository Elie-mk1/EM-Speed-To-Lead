-- =====================================================================
-- EM Speed-to-Lead: move the SAMPLE data forward so it ends yesterday.
-- Run in Supabase -> SQL Editor whenever the dashboard's "Last 30 days"
-- looks empty (e.g. right before recording the Loom). Safe to re-run.
-- Only touches rows flagged is_demo and the ad spend sheet; real leads are untouched.
-- =====================================================================
begin;

-- How many days to shift: so the last day of the ad spend sheet becomes yesterday
create temp table shift on commit drop as
select ((current_date - 1) - max(spend_date))::int as d from em_ad_spend;

-- 1. Sample leads: move every timestamp by the same number of days
update em_leads set
  opted_in_at    = opted_in_at    + make_interval(days => (select d from shift)),
  first_reply_at = first_reply_at + make_interval(days => (select d from shift)),
  booked_at      = booked_at      + make_interval(days => (select d from shift)),
  showed_at      = showed_at      + make_interval(days => (select d from shift)),
  no_show_at     = no_show_at     + make_interval(days => (select d from shift)),
  updated_at     = now()
where is_demo = true;

-- 2. Ad spend sheet: copy, clear, re-insert with shifted dates (avoids date clashes)
create temp table spend_copy on commit drop as select * from em_ad_spend;
delete from em_ad_spend;
insert into em_ad_spend (spend_date, source, amount, notes)
select spend_date + (select d from shift), source, amount, notes from spend_copy;

commit;

-- Check: the sheet should now end yesterday, and all 3 sources should have bookings
select min(spend_date) as sheet_starts, max(spend_date) as sheet_ends from em_ad_spend;
select source, leads, booked, cost_per_booked
from em_dashboard(current_date - 29, current_date);
