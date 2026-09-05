create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  portfolio_id uuid null,

  report_month date not null,

  status text not null default 'completed'
    check (
      status in (
        'queued',
        'generating',
        'completed',
        'failed'
      )
    ),

  portfolio_value numeric,
  monthly_return numeric,

  executive_summary text,

  report_json jsonb not null default '{}'::jsonb,

  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, portfolio_id, report_month)
);

create index if not exists
  monthly_reports_user_id_idx
on public.monthly_reports(user_id);

create index if not exists
  monthly_reports_report_month_idx
on public.monthly_reports(report_month desc);

alter table public.monthly_reports
enable row level security;

create policy
  "Users can view own monthly reports"
on public.monthly_reports
for select
using (
  auth.uid() = user_id
);

create policy
  "Users can create own monthly reports"
on public.monthly_reports
for insert
with check (
  auth.uid() = user_id
);

create policy
  "Users can update own monthly reports"
on public.monthly_reports
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy
  "Users can delete own monthly reports"
on public.monthly_reports
for delete
using (
  auth.uid() = user_id
);