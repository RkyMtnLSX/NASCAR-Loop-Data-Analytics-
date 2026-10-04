-- flags_race (2026-10-04): FLAGS-style field-adjusted green speed per driver per race.
-- See BACKTEST_LOG 2026-10-04 "FLAGS-style field-adjusted green speed" for the frozen definition.
create table if not exists flags_race (
  id bigserial primary key,
  series text not null,
  year int not null,
  nascar_race_id int not null,
  race_number int,
  track_name text,
  driver_name text not null,
  driver_id int,
  car_number text,
  flags_pct double precision,
  flags_rank int,
  kept_laps int,
  racing_laps int,
  created_at timestamptz default now(),
  unique (series, year, nascar_race_id, driver_name)
);
alter table flags_race enable row level security;
drop policy if exists flags_read on flags_race;
create policy flags_read on flags_race for select using (true);
drop policy if exists flags_write on flags_race;
create policy flags_write on flags_race for all to authenticated using (true) with check (true);
