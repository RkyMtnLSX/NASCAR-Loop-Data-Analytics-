#!/usr/bin/env python3
"""
PitBoard pit_stops backfill
===========================
Loads raw NASCAR pit-stop telemetry (cf.nascar.com live-pit-data, populated
2018+) into the Supabase `pit_stops` table, driven FROM the PitBoard `races`
registry so every row inherits the canonical track_name, SEASON race_number,
race_id FK, the 2022 era floor, and the exhibition exclusion for free.

Run pit_stops_schema.sql in the Supabase SQL editor ONCE before first use.

Usage
-----
  python pitboard_pit_backfill.py --year 2026                # backfill 2026, all series
  python pitboard_pit_backfill.py --year 2026 --series trucks
  python pitboard_pit_backfill.py --year all                 # 2022..2026
  python pitboard_pit_backfill.py --year 2026 --dry-run      # fetch+match+report, no writes
  python pitboard_pit_backfill.py --race-id 409              # one PitBoard race

Domain rules enforced here (see pitboard.md):
  * Driven from `races` (exhibition IS NOT TRUE, year >= 2022) -> no All-Star/
    Clash/Duels, no pre-Next-Gen Cup.
  * Raw seconds stored; NEVER pool across series in analysis.
  * organization = weekend-feed team_name (crew key = car+org+season).
  * Sentinels (-1, and 0 for prev/next lap time) -> NULL at load.
  * Idempotent: DELETE by race_id then INSERT (unique index is the backstop).

Requires: pip install requests
"""

import argparse
import json
import sys
import time
from datetime import datetime, timedelta

import requests

# ---------------------------------------------------------------- config
# Public values (same fallbacks as src/lib/supabase.js). Env vars override.
import os
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://dqexnylexbypjtiuctxd.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_pVrtVEoQD1i9LiIvaXhS4g_ZDaUUccj")

NASCAR = "https://cf.nascar.com"
SERIES_TO_NASCAR = {"cup": 1, "oreilly": 2, "trucks": 3}
YEARS_ALL = [2022, 2023, 2024, 2025, 2026]

SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}
NASCAR_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.nascar.com/",
}

# NASCAR track spellings -> canonical tracks.name (see pitboard.md #117 / Atlanta note)
TRACK_ALIASES = {
    "echopark speedway": "atlanta motor speedway",
    "circuit of the americas": "circuit of the americas",
    "san diego street course": "naval base coronado",
    "the milwaukee mile": "milwaukee mile",
    "milwaukee mile speedway": "milwaukee mile",
    "lucas oil indianapolis raceway park": "lucas oil indianapolis raceway park",
    "lucas oil raceway": "lucas oil indianapolis raceway park",
    "world wide technology raceway": "world wide technology raceway",
    "charlotte motor speedway road course": "charlotte motor speedway road course",
}


def norm_track(s):
    s = "".join(c if c.isalnum() or c == " " else " " for c in (s or "").lower())
    s = " ".join(s.split())
    return TRACK_ALIASES.get(s, s)


def norm_name(s):
    """Mirror of GradeCenter norm(): lowercase, strip accents, non-alnum ->
    space, drop jr/sr/ii/iii/iv (+ stray p/i tokens from '(P)'/'(i)'), collapse."""
    import unicodedata
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = "".join(c if c.isalnum() or c == " " else " " for c in s)
    toks = [t for t in s.split() if t not in ("jr", "sr", "ii", "iii", "iv", "p", "i")]
    return " ".join(toks)


# ---------------------------------------------------------------- http utils
def get_json(url, headers, quiet=False, tries=3):
    for attempt in range(tries):
        try:
            r = requests.get(url, headers=headers, timeout=20)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (403, 404, 406):
                if not quiet:
                    print(f"  [{r.status_code}] {url}")
                return None
        except (requests.RequestException, json.JSONDecodeError) as e:
            if attempt == tries - 1 and not quiet:
                print(f"  fetch failed: {url} ({e})")
        time.sleep(1.2 * (attempt + 1))
    return None


def sb_get(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    r = requests.get(url, headers=SB_HEADERS, timeout=30)
    if r.status_code != 200:
        sys.exit(f"Supabase GET {path} failed [{r.status_code}]: {r.text[:300]}")
    return r.json()


def sb_delete(path, params):
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    r = requests.delete(url, headers=SB_HEADERS, timeout=60)
    if r.status_code not in (200, 204):
        sys.exit(f"Supabase DELETE {path} failed [{r.status_code}]: {r.text[:300]}"
                 "\n(Did you run pit_stops_schema.sql? RLS delete policy required.)")


def sb_insert(path, rows, chunk=500):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    hdrs = dict(SB_HEADERS, Prefer="return=minimal")
    for i in range(0, len(rows), chunk):
        r = requests.post(url, headers=hdrs, json=rows[i:i + chunk], timeout=120)
        if r.status_code not in (200, 201, 204):
            sys.exit(f"Supabase INSERT {path} failed [{r.status_code}]: {r.text[:300]}")


# ---------------------------------------------------------------- transforms
def _num(v, treat_zero_as_null=False):
    """NASCAR sentinel cleanup: -1 (and optionally 0) means not-populated."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f <= 0 and (treat_zero_as_null or f < 0):
        return None
    return f


def _rank(v):
    try:
        i = int(v)
    except (TypeError, ValueError):
        return None
    return i if i > 0 else None


def transform_stop(p, race, team_map):
    car = str(p.get("vehicle_number") or "").strip()
    tires = sum(bool(p.get(k)) for k in (
        "left_front_tire_changed", "left_rear_tire_changed",
        "right_front_tire_changed", "right_rear_tire_changed"))
    info = team_map.get(car, {})
    flag_in = p.get("pit_in_flag_status")
    return {
        "race_id": race["id"],
        "nascar_race_id": race["nascar_race_id"],
        "series": race["series"],
        "year": race["year"],
        "track_name": race["track_name"],
        "race_number": race["race_number"],
        "car_number": car,
        "driver_name": p.get("driver_name"),
        "nascar_driver_id": info.get("driver_id"),
        "organization": info.get("team_name"),
        "crew_chief": info.get("crew_chief"),
        "manufacturer": p.get("vehicle_manufacturer"),
        "pit_box": info.get("pit_box"),
        "lap": p.get("lap_count"),
        "leader_lap": p.get("leader_lap"),
        "flag_state": flag_in,
        "flag_state_out": p.get("pit_out_flag_status"),
        "green_flag": flag_in == 1,
        "pit_stop_type": p.get("pit_stop_type") or None,
        "tires_changed": tires,
        "lf": bool(p.get("left_front_tire_changed")),
        "lr": bool(p.get("left_rear_tire_changed")),
        "rf": bool(p.get("right_front_tire_changed")),
        "rr": bool(p.get("right_rear_tire_changed")),
        "box_time": _num(p.get("pit_stop_duration")),
        "pit_road_time": _num(p.get("total_duration")),
        "in_travel": _num(p.get("in_travel_duration")),
        "out_travel": _num(p.get("out_travel_duration")),
        "pit_in_race_time": _num(p.get("pit_in_race_time")),
        "pit_out_race_time": _num(p.get("pit_out_race_time")),
        "pit_in_rank": _rank(p.get("pit_in_rank")),
        "pit_out_rank": _rank(p.get("pit_out_rank")),
        "positions_gained_lost": p.get("positions_gained_lost"),
        # 0 here means not-recorded (uniformly 0 pre-~2022) -> NULL
        "prev_lap_time": _num(p.get("previous_lap_time"), treat_zero_as_null=True),
        "next_lap_time": _num(p.get("next_lap_time"), treat_zero_as_null=True),
    }


def dedupe_stops(rows):
    """NASCAR's archived feed can contain literal duplicate stop rows (same
    car/lap/pit_in_race_time — observed cup 2026 R2). Keep the most complete
    row per unique-index key so the insert can never violate
    pit_stops_stop_unique. Returns (deduped_rows, n_dropped)."""
    best = {}
    for r in rows:
        key = (r["car_number"], r["lap"],
               -1 if r["pit_in_race_time"] is None else r["pit_in_race_time"])
        score = sum(v is not None for v in r.values())
        if key not in best or score > best[key][0]:
            best[key] = (score, r)
    out = [r for _, r in best.values()]
    return out, len(rows) - len(out)


def build_team_map(weekend):
    """car_number -> team/driver info from weekend_race[0].results."""
    out = {}
    wr = (weekend or {}).get("weekend_race") or [{}]
    for res in (wr[0].get("results") or []):
        car = str(res.get("car_number") or res.get("official_car_number") or "").strip()
        if car:
            out[car] = {
                "team_name": res.get("team_name") or res.get("owner_fullname"),
                "driver_id": res.get("driver_id"),
                "crew_chief": res.get("crew_chief_fullname"),
                "pit_box": res.get("pit_box"),
            }
    race_type = (wr[0] or {}).get("race_type_id")
    return out, race_type


# ---------------------------------------------------------------- matching
def load_nascar_race_index(years):
    """{(nascar_series_id, year): [race entries with parsed dates]}"""
    idx = {}
    for year in years:
        data = get_json(f"{NASCAR}/cacher/{year}/race_list_basic.json", NASCAR_HEADERS)
        if not data:
            print(f"  !! no NASCAR race list for {year}")
            continue
        for key, races in data.items():
            try:
                sid = int(key.split("_")[1])
            except (IndexError, ValueError):
                continue
            for r in races:
                raw = str(r.get("race_date") or r.get("date_scheduled") or "")[:10]
                try:
                    d = datetime.fromisoformat(raw).date()
                except ValueError:
                    d = None
                idx.setdefault((sid, year), []).append({
                    "nascar_race_id": r.get("race_id"),
                    "race_name": r.get("race_name"),
                    "track": r.get("track_name"),
                    "date": d,
                })
        time.sleep(0.4)
    return idx


def match_race(row, idx):
    """PitBoard races row -> NASCAR race entry. Date first, then track order."""
    sid = SERIES_TO_NASCAR[row["series"]]
    cands = idx.get((sid, row["year"]), [])
    # 1) date match (+/- 1 day)
    rd = str(row.get("race_date") or "")[:10]
    if rd:
        try:
            d = datetime.fromisoformat(rd).date()
            hits = [c for c in cands if c["date"] and abs((c["date"] - d).days) <= 1]
            if len(hits) == 1:
                return hits[0], "date"
            if len(hits) > 1:  # same-weekend doubleheader: disambiguate by track
                t_hits = [c for c in hits if norm_track(c["track"]) == norm_track(row["track_name"])]
                if len(t_hits) == 1:
                    return t_hits[0], "date+track"
        except ValueError:
            pass
    # 2) no/ambiguous date: same track, positional by season order
    track_c = sorted((c for c in cands
                      if norm_track(c["track"]) == norm_track(row["track_name"])),
                     key=lambda c: c["date"] or datetime.max.date())
    if len(track_c) == 1:
        return track_c[0], "track"
    if len(track_c) > 1 and row.get("_track_occurrence") is not None:
        i = row["_track_occurrence"]
        if i < len(track_c):
            return track_c[i], "track-order"
    return None, None


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", default="2026",
                    help="season year, or 'all' for 2022-2026 (default 2026)")
    ap.add_argument("--series", choices=["cup", "oreilly", "trucks"],
                    help="limit to one series (default all three)")
    ap.add_argument("--race-id", type=int, help="single PitBoard races.id")
    ap.add_argument("--dry-run", action="store_true",
                    help="fetch + match + report only; no DB writes")
    args = ap.parse_args()

    years = YEARS_ALL if args.year == "all" else [int(args.year)]

    # -- 1. the races registry drives everything
    rows = sb_get("races", "select=id,series,year,race_number,track_name,"
                           "race_date,exhibition&order=id.asc&limit=100000")
    races = [r for r in rows
             if r.get("year") in years
             and r.get("year") and r["year"] >= 2022            # era floor
             and not r.get("exhibition")                        # no All-Star/Clash
             and r.get("series") in SERIES_TO_NASCAR
             and (not args.series or r["series"] == args.series)
             and (not args.race_id or r["id"] == args.race_id)]
    # positional index for two-race tracks with missing dates
    seen = {}
    for r in sorted(races, key=lambda x: (x["series"], x["year"],
                                          x.get("race_number") or 0)):
        k = (r["series"], r["year"], norm_track(r["track_name"]))
        r["_track_occurrence"] = seen.get(k, 0)
        seen[k] = r["_track_occurrence"] + 1
    print(f"{len(races)} points races in registry scope "
          f"(years={years}, series={args.series or 'all'})")
    if not races:
        sys.exit("Nothing to do.")

    idx = load_nascar_race_index(sorted({r["year"] for r in races}))

    unmatched, empty, loaded = [], [], []
    for race in sorted(races, key=lambda r: (r["year"], r["series"],
                                             r.get("race_number") or 0)):
        label = (f"{race['series']:>7} {race['year']} R{race.get('race_number')} "
                 f"{race['track_name']}")
        m, how = match_race(race, idx)
        if not m:
            unmatched.append(label)
            print(f"  SKIP (no NASCAR match): {label}")
            continue
        race["nascar_race_id"] = m["nascar_race_id"]
        sid = SERIES_TO_NASCAR[race["series"]]

        pit = get_json(f"{NASCAR}/cacher/live/series_{sid}/{m['nascar_race_id']}/"
                       f"live-pit-data.json", NASCAR_HEADERS, quiet=True)
        time.sleep(0.4)
        if not pit:
            empty.append(label)
            print(f"  0 pit rows ({how}-matched nascar_id={m['nascar_race_id']}): {label}")
            continue

        weekend = get_json(f"{NASCAR}/cacher/{race['year']}/{sid}/"
                           f"{m['nascar_race_id']}/weekend-feed.json",
                           NASCAR_HEADERS, quiet=True)
        time.sleep(0.4)
        team_map, race_type = build_team_map(weekend)
        if race_type not in (None, 1):
            print(f"  SKIP (race_type_id={race_type}, not points): {label}")
            continue

        out = [transform_stop(p, race, team_map) for p in pit]
        out = [o for o in out if o["car_number"]]
        out, n_dupes = dedupe_stops(out)
        if n_dupes:
            print(f"  note: {n_dupes} duplicate feed row(s) dropped: {label}")

        if args.dry_run:
            print(f"  DRY {label}: {len(out)} stops "
                  f"({sum(1 for o in out if o['green_flag'])} green, "
                  f"{sum(1 for o in out if o['tires_changed'] == 4)} four-tire, "
                  f"org filled {sum(1 for o in out if o['organization'])}/{len(out)})")
            loaded.append((race, len(out), None))
            continue

        sb_delete("pit_stops", f"race_id=eq.{race['id']}")
        sb_insert("pit_stops", out)

        # -- verify join to loop_data
        loop = sb_get("loop_data", f"select=car_number,driver_name&race_id=eq."
                                   f"{race['id']}&order=id.asc&limit=1000")
        loop_cars = {str(l.get("car_number") or "").strip() for l in loop} - {""}
        loop_names = {norm_name(l.get("driver_name")) for l in loop} - {""}
        pit_cars = {o["car_number"] for o in out}
        pit_names = {norm_name(o["driver_name"]) for o in out} - {""}
        car_rate = (len(pit_cars & loop_cars) / len(pit_cars) * 100) if loop_cars else None
        name_rate = (len(pit_names & loop_names) / len(pit_names) * 100) if loop_names else None
        loaded.append((race, len(out), (car_rate, name_rate)))
        j = (f"join: cars {car_rate:.0f}% names {name_rate:.0f}%"
             if car_rate is not None else "join: no loop_data rows")
        print(f"  OK  {label}: {len(out)} stops  {j}")

    # -- report
    print("\n================ SUMMARY ================")
    print(f"loaded: {len(loaded)} races, {sum(n for _, n, _ in loaded)} pit rows")
    if not args.dry_run and loaded:
        weak = [(r, n, v) for r, n, v in loaded if v and v[0] is not None and v[0] < 90]
        if weak:
            print("races with car-join under 90% (inspect these):")
            for r, n, v in weak:
                print(f"  {r['series']} {r['year']} R{r['race_number']} "
                      f"{r['track_name']}: cars {v[0]:.0f}% names {v[1]:.0f}%")
        else:
            print("all loaded races join loop_data at 90%+ by car_number")
    if empty:
        print(f"\n{len(empty)} matched races had NO pit feed (see list above)")
    if unmatched:
        print(f"\n{len(unmatched)} registry races could not be matched to a "
              f"NASCAR race id — resolve manually:")
        for u in unmatched:
            print(f"  {u}")


if __name__ == "__main__":
    main()
