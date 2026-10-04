-- clean_pace_race (2026-10-04): CLEAN PACE - field-adjusted green-lap pace while the car is healthy, per driver per race.
-- See BACKTEST_LOG 2026-10-04 "Clean Pace" for the frozen definition.
create table if not exists clean_pace_race (
  id bigserial primary key,
  series text not null,
  year int not null,
  nascar_race_id int not null,
  race_number int,
  track_name text,
  driver_name text not null,
  driver_id int,
  car_number text,
  clean_pace_pct double precision,
  clean_pace_rank int,
  kept_laps int,
  racing_laps int,
  created_at timestamptz default now(),
  unique (series, year, nascar_race_id, driver_name)
);
alter table clean_pace_race enable row level security;
drop policy if exists clean_pace_read on clean_pace_race;
create policy clean_pace_read on clean_pace_race for select using (true);
drop policy if exists clean_pace_write on clean_pace_race;
create policy clean_pace_write on clean_pace_race for all to authenticated using (true) with check (true);
