-- PRACTICE SESSION-COLLISION AUDIT (2026-08-22, corrected 2026-08-22 later)
-- READ-ONLY. Run in the Supabase SQL editor. Nothing here deletes anything.
-- Context: BACKTEST_LOG 2026-08-22 entry + the CORRECTION directly below it.
--
-- WHAT THE PROBLEM IS: two DIFFERENT practice sessions were uploaded under the same
-- session_number. Lap numbering restarts at 1 each session, so every driver who ran
-- both now has two lap 1s, two lap 2s, etc. Every row is a REAL LAP -- nothing is
-- duplicated in the "same fact twice" sense.
--
-- WHY IT MATTERS: parseStints only continues a run on prev+1, so a sorted
-- 1,2,3,3,4,4,5,5 shatters into 1-2 lap fragments, no run clears the 10-clean-lap
-- bar, and the driver takes the missing-longRun->25 fill after a full day of running.
--
-- THE FIX IS RE-LABELLING, NOT DELETION. Deleting the "extra" rows would throw away
-- an entire real practice session. Only the byte-identical pairs in query 4 are
-- dedupe-eligible, and even those move historical grades (and therefore the 97-race
-- harness baseline), so they need a grade-bar before/after rather than a quiet cleanup.

-- 1. SCOPE -- which track-sessions hold colliding lap numbers, worst first ----
select series, year, track_name, session_number,
       count(distinct driver_name) as drivers_affected,
       sum(n - 1)                  as colliding_rows
from (
  select series, year, track_name, session_number, driver_name, lap_number,
         count(*) as n
  from practice_laps
  group by 1,2,3,4,5,6
  having count(*) > 1
) d
group by 1,2,3,4
order by colliding_rows desc;

-- 2. THE DIAGNOSIS QUERY -- separate upload batches inside one session_number.
-- Two batches with different driver counts / different max lap = two real sessions.
-- One batch = the collisions came from somewhere else, investigate before acting.
select series, year, track_name, session_number,
       date_trunc('minute', created_at) as upload_batch,
       count(*)                         as rows,
       count(distinct driver_name)      as drivers,
       max(lap_number)                  as max_lap
from practice_laps
group by 1,2,3,4,5
having (series, year, track_name, session_number) in (
  select series, year, track_name, session_number
  from practice_laps
  group by series, year, track_name, session_number, driver_name, lap_number
  having count(*) > 1
)
order by series, year, track_name, session_number, upload_batch;

-- 3. CONFIRM two batches are different SESSIONS, not a re-scrape of one.
-- Re-scrape  => near-zero time deltas, no new drivers.
-- Two sessions => a large share of laps differ materially, and the later batch
--                 usually carries drivers the earlier one never had.
-- Fill in one track from query 2 and compare the two batch timestamps.
-- with b as (
--   select driver_name, lap_number, lap_time,
--          date_trunc('minute', created_at) as batch
--   from practice_laps
--   where series = 'cup' and year = 2025
--     and track_name = 'Phoenix Raceway' and session_number = 1
-- )
-- select count(*)                                              as matched_laps,
--        round(avg(abs(x.lap_time - y.lap_time))::numeric, 3)  as mean_abs_delta,
--        sum(case when abs(x.lap_time - y.lap_time) < 0.5 then 1 else 0 end) as within_half_sec
-- from b x join b y
--   on x.driver_name = y.driver_name and x.lap_number = y.lap_number
--  and x.batch < y.batch;

-- 4. THE ONE DEDUPE-ELIGIBLE CLASS -- byte-identical rows (true double-inserts).
-- Count them first; this is a much smaller population than query 1.
select count(*) as identical_pairs
from (
  select series, year, track_name, session_number, driver_name, lap_number
  from practice_laps
  group by 1,2,3,4,5,6
  having count(*) > 1
     and max(lap_time) - min(lap_time) < 0.001
) d;

-- 5. RE-LABEL TEMPLATE -- do not run until query 2 and 3 confirm the batch split.
-- Moves the LATER batch to its own session_number instead of deleting anything.
-- update practice_laps
--    set session_number = 2
--  where series = 'cup' and year = 2025
--    and track_name = 'Phoenix Raceway' and session_number = 1
--    and created_at >= '2026-07-04T07:30:00Z';
