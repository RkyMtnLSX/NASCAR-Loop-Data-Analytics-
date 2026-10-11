-- dfs_field_lineups (2026-10-11): the CONTEST FIELD - every entry's lineup from the DraftKings contest-standings CSV the
-- ownership ingest already reads, de-duplicated to one row per distinct lineup with its copy count and score. Entry
-- names are NOT stored (anonymised field; the operator's own entries live in dfs_operator_entries). Why: the 10-11
-- contest-aware study (BACKTEST_LOG) found our build's #1 lineup is the field's most-duplicated lineup on several nights
-- (43 copies at O'Reilly Darlington) and that an ownership-sampled field cannot reproduce that; a real-field corpus is
-- the prerequisite for ever re-asking the question, and it costs nothing to keep since the file is uploaded weekly.
-- One row per (contest, lineup). Run in the Supabase SQL editor. Admin-only like dfs_operator_entries.
create table if not exists public.dfs_field_lineups (
  id bigint generated always as identity primary key,
  series text not null,
  race_year int not null,
  race_number int,
  track_name text,
  contest_type text not null default 'gpp',
  contest_id text not null,            -- from the standings file name (contest-standings-<id>.csv) or 'unknown'
  contest_entries int,                 -- entries parsed from the file
  lineup text[] not null,              -- 6 driver names, sorted
  copies int not null,                 -- how many entries fielded exactly this lineup
  points numeric,                      -- the lineup's score in the contest
  best_rank int,                       -- best rank among its copies
  created_at timestamptz default now(),
  unique (series, race_year, race_number, contest_id, lineup)
);
create index if not exists dfs_field_lineups_race on public.dfs_field_lineups (series, race_year, race_number);
alter table public.dfs_field_lineups enable row level security;
drop policy if exists admin_all on public.dfs_field_lineups;
create policy admin_all on public.dfs_field_lineups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
