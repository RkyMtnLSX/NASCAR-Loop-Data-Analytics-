-- dfs_operator_entries (2026-09-14): the OPERATOR'S OWN DraftKings entries per contest, captured from the
-- same contest-standings CSV the ownership ingest reads (rows whose EntryName is the operator's DK
-- username). Operator data only - never a subscriber's (product rule 2026-09-13: nothing a user uploads
-- is stored server-side). Read by DFS Replay so the ledger scores the operator's real construction
-- against cash / GPP / Portfolio on the same ladder every week (the 09-05 "operator beat both solvers"
-- finding was an n=1 hand computation until now).
-- Run in the Supabase SQL editor. Policies follow table_lockdown_64: admin-only (admin_all).
create table if not exists public.dfs_operator_entries (
  id bigint generated always as identity primary key,
  series text not null,
  race_year int not null,
  race_number int,
  track_name text,
  contest_type text not null default 'gpp',
  contest_id text not null,            -- from the standings file name (contest-standings-<id>.csv) or 'unknown'
  dk_user text not null,
  entries int not null,
  contest_entries int,
  lineups jsonb not null,              -- [{ rank, points, drivers: [6 names] }]
  exposure jsonb not null,             -- { driver_name: pct of this contest's entries }
  best_rank int,
  best_points numeric,
  mean_pct numeric,                    -- mean percentile of the entries in the field (100 = winner)
  above_median int,
  prize numeric,                       -- realised prize, entry-fee units, DK-like curve (same as the Replay rows)
  created_at timestamptz default now(),
  unique (series, race_year, race_number, contest_id)
);
alter table public.dfs_operator_entries enable row level security;
drop policy if exists admin_all on public.dfs_operator_entries;
create policy admin_all on public.dfs_operator_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Replay ledger column for the operator row
alter table public.dfs_replays add column if not exists operator_json jsonb;
alter table public.dfs_replays add column if not exists operator_prize numeric;
alter table public.dfs_replays add column if not exists operator_entries int;
