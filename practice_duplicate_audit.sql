-- PRACTICE LAP DUPLICATE AUDIT (2026-08-22)
-- READ-ONLY. Run in the Supabase SQL editor. Nothing here deletes anything.
-- Context: BACKTEST_LOG 2026-08-22. A duplicated lap_number fragments the session in
-- parseStints (a repeat is not prev+1), which costs the driver their long-run grade.

-- 1. HOW BIG IS IT, full table, by year --------------------------------------
select year,
       count(*)                                             as dup_pairs,
       count(distinct (series, track_name, session_number, driver_name)) as sessions_hit
from (
  select series, year, track_name, session_number, driver_name, lap_number,
         count(*) as n
  from practice_laps
  group by 1,2,3,4,5,6
  having count(*) > 1
) d
group by year
order by year;

-- 2. WHICH SESSIONS, worst first ---------------------------------------------
select series, year, track_name, session_number,
       count(distinct driver_name) as drivers_affected,
       sum(n - 1)                  as extra_rows
from (
  select series, year, track_name, session_number, driver_name, lap_number,
         count(*) as n
  from practice_laps
  group by 1,2,3,4,5,6
  having count(*) > 1
) d
group by 1,2,3,4
order by extra_rows desc
limit 40;

-- 3. WHAT KIND OF DUPLICATE -- identical re-insert vs two different runs ------
-- Identical times  => a double upload; safe to collapse.
-- Different times  => two sessions (or a re-upload) interleaved under one
--                     session_number; collapsing would DELETE real laps.
--                     These need the session split, not a dedupe.
select case when max(lap_time) - min(lap_time) < 0.001
            then 'identical_reinsert' else 'different_times' end as kind,
       count(*) as pairs
from practice_laps
group by series, year, track_name, session_number, driver_name, lap_number
having count(*) > 1;

-- 4. INSPECT ONE SESSION before deciding anything -----------------------------
-- Fill in the four values from query 2, then eyeball the pattern.
-- select driver_name, lap_number, lap_time, captured_at, id
-- from practice_laps
-- where series = 'cup' and year = 2025
--   and track_name = 'Phoenix Raceway' and session_number = 1
--   and driver_name = '<driver>'
-- order by lap_number, id;

-- 5. DO NOT RUN YET -- candidate dedupe for the identical-reinsert class only.
-- Historical grades move if this runs, which moves the 97-race harness baseline,
-- so it needs a grade-bar before/after first. Kept here so the rule is written down.
-- delete from practice_laps p using practice_laps q
--  where p.id > q.id
--    and p.series = q.series and p.year = q.year
--    and p.track_name = q.track_name and p.session_number = q.session_number
--    and p.driver_name = q.driver_name and p.lap_number = q.lap_number
--    and abs(p.lap_time - q.lap_time) < 0.001;
