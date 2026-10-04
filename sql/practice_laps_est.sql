-- practice_laps.est (2026-10-04): 1 = lap reconstructed by the practice watcher because NASCAR's live feed
-- skipped it (the feed refreshes ~once per lap during practice; a 2-lap jump is split evenly from the
-- elapsed-time delta - exact sum, estimated split). Vegas cup S1: 167 of 1,462 laps. The Report Card and
-- Lap Comparison prefer N-lap windows with no estimated lap and mark fallbacks with ~.
alter table practice_laps add column if not exists est smallint not null default 0;
