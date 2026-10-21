-- =====================================================================
-- EM Speed-to-Lead Revenue Engine — database schema (Supabase / Postgres)
-- Run once: Supabase → SQL Editor → New query → paste all → Run
-- =====================================================================

-- 1. LEADS: one row per person, the source of truth for the dashboard
create table em_leads (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null check (source in ('meta','website','referral')),
  external_id         text,                     -- id from the source (e.g. Meta leadgen_id)
  first_name          text,
  last_name           text,
  email               text not null,
  phone               text,
  company             text,
  role                text,
  company_size        text,
  monthly_budget      numeric,
  service             text,
  timeline            text,
  message             text,
  referred_by         text,
  ghl_contact_id      text,
  ghl_opportunity_id  text,
  ai_status           text check (ai_status in ('Qualified','Not Qualified','Needs Review')),
  ai_score            int  check (ai_score between 0 and 100),
  ai_reason           text,
  stage               text not null default 'New',
  opted_in_at         timestamptz not null default now(),  -- clock starts here
  first_reply_at      timestamptz,                         -- clock stops here
  booked_at           timestamptz,
  showed_at           timestamptz,
  no_show_at          timestamptz,
  automation_paused   boolean not null default false,
  paused_reason       text,
  is_demo             boolean not null default false,      -- seeded history for the dashboard
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index em_leads_email_idx  on em_leads (lower(email));
create index em_leads_source_idx on em_leads (source, opted_in_at);

-- 2. EVENTS: every incoming webhook, deduplicated by a unique key.
--    Insert with ON CONFLICT DO NOTHING RETURNING * → no row back = duplicate → stop.
--    Key examples: 'meta:<leadgen_id>', 'website:<submission_id>',
--                  'appt:<appointment_id>:<status>:<start_time>'
create table em_events (
  event_key    text primary key,
  event_type   text not null,
  lead_id      uuid references em_leads(id),
  payload      jsonb,
  received_at  timestamptz not null default now()
);

-- 3. APPOINTMENTS: current state of each GHL appointment.
--    Reschedule = same id, new start_time → old reminders get cancelled.
create table em_appointments (
  id                text primary key,             -- GHL appointment id
  lead_id           uuid not null references em_leads(id),
  start_time        timestamptz not null,
  status            text not null check (status in ('booked','cancelled','showed','noshow')),
  reschedule_count  int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 4. MESSAGES: every message the system tries to send.
--    unique(lead_id, message_key) makes a double-send impossible.
--    Key examples: 'first_reply', 'followup_1',
--                  'reminder_24h:<appt_id>:<start_time>', 'rebook_1:<appt_id>'
create table em_messages (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references em_leads(id),
  message_key     text not null,
  channel         text not null default 'email',
  subject         text,
  body            text,
  status          text not null default 'pending'
                  check (status in ('pending','sent','failed','skipped')),
  skip_reason     text,                           -- e.g. 'paused', 'appointment changed'
  ghl_message_id  text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  unique (lead_id, message_key)
);

-- 5. JOBS: scheduled reminders and follow-ups (instead of n8n Wait nodes).
--    The Scheduler picks status='pending' and run_at <= now() every minute.
--    Reschedule/cancel/human reply → status='cancelled'.
create table em_jobs (
  id              uuid primary key default gen_random_uuid(),
  job_key         text not null unique,           -- same pattern as message_key
  lead_id         uuid not null references em_leads(id),
  job_type        text not null,                  -- reminder_24h, reminder_1h, followup_1, rebook_1 ...
  appointment_id  text references em_appointments(id),
  run_at          timestamptz not null,
  status          text not null default 'pending'
                  check (status in ('pending','processing','done','cancelled','failed')),
  cancel_reason   text,
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index em_jobs_due_idx on em_jobs (status, run_at);

-- 6. ERRORS: every failure is logged here AND emailed to you.
create table em_errors (
  id          bigserial primary key,
  workflow    text,
  node        text,
  message     text,
  lead_id     uuid,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

-- 7. SECURITY: lock every table from the public API.
--    n8n connects directly as the database owner (bypasses RLS);
--    the dashboard will read server-side only. No public policies = no public access.
alter table em_leads        enable row level security;
alter table em_events       enable row level security;
alter table em_appointments enable row level security;
alter table em_messages     enable row level security;
alter table em_jobs         enable row level security;
alter table em_errors       enable row level security;
