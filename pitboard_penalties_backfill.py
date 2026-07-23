#!/usr/bin/env python3
"""
PitBoard pit_penalties backfill — v2 (classify-before-trim fix, 2026-07-23)
===========================================================================
Parses pit-road PENALTY calls out of NASCAR race-control lap notes
(cf.nascar.com cacher/{year}/{series_id}/{nascar_race_id}/lap-notes.json,
archived 2018+; we ingest 2022+ per era rules) into the Supabase
`pit_penalties` table. Sibling of pitboard_pit_backfill.py.

v2 fix: v1 trimmed each car's phrase to 8 words BEFORE keyword classification,
chopping keywords off verbose race-control prose ("#4 comes to pit road but is
penalized for an uncontrolled tire" -> keyword lost -> misfiled as 'other' or
dropped). v2 classifies on the car's FULL text segment (up to the next car
mention) and trims only for storage. Re-running is safe (delete-then-insert).

Run pit_penalties_schema.sql in the Supabase SQL editor ONCE before first use.

Usage
-----
  python pitboard_penalties_backfill.py --year 2026
  python pitboard_penalties_backfill.py --year all            # 2022..2026
  python pitboard_penalties_backfill.py --year all --dry-run  # parse+report only

Live results (2026-07-23, --year all): 386 races -> 1,129 penalties
(driver 567 / crew 352 / other 210), 7 unparsed sentences (all pronoun-
referenced or retrospective recaps — unparseable at sentence level by design).
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime

import requests

# ---------------------------------------------------------------- config
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

TRACK_ALIASES = {
    "echopark speedway": "atlanta motor speedway",
    "san diego street course": "naval base coronado",
    "the milwaukee mile": "milwaukee mile",
    "milwaukee mile speedway": "milwaukee mile",
    "lucas oil raceway": "lucas oil indianapolis raceway park",
}


def norm_track(s):
    s = "".join(c if c.isalnum() or c == " " else " " for c in (s or "").lower())
    s = " ".join(s.split())
    return TRACK_ALIASES.get(s, s)


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


def sb_get_paged(path, params=""):
    out, off = [], 0
    while True:
        page = sb_get(path, f"{params}&limit=1000&offset={off}")
        out.extend(page)
        if len(page) < 1000:
            return out
        off += 1000


def sb_delete(path, params):
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    r = requests.delete(url, headers=SB_HEADERS, timeout=60)
    if r.status_code not in (200, 204):
        sys.exit(f"Supabase DELETE {path} failed [{r.status_code}]: {r.text[:300]}"
                 "\n(Did you run pit_penalties_schema.sql? RLS delete policy required.)")


def sb_insert(path, rows, chunk=500):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    hdrs = dict(SB_HEADERS, Prefer="return=minimal")
    for i in range(0, len(rows), chunk):
        r = requests.post(url, headers=hdrs, json=rows[i:i + chunk], timeout=120)
        if r.status_code not in (200, 201, 204):
            sys.exit(f"Supabase INSERT {path} failed [{r.status_code}]: {r.text[:300]}")


# ---------------------------------------------------------------- penalty parsing
PEN_SENT = re.compile(
    r"penalt|violation|too fast|over the wall too soon|uncontrolled tire|"
    r"too many (?:men|crew)|commitment|improper fueling|outside (?:his |the )?box|"
    r"speeding|held for", re.I)

DRIVER_PEN = re.compile(
    r"speeding|too fast|commitment|outside (?:his |the )?box|"
    r"running over (?:the )?equipment", re.I)
CREW_PEN = re.compile(
    r"over the wall too soon|crew over the wall|too many (?:men|crew)|"
    r"uncontrolled tire|improper fueling|safety violation|"
    r"equipment (?:interference|over the wall)|lug ?nut", re.I)
GENERIC_PEN = re.compile(r"penalt|violation|held for", re.I)
CAR = re.compile(r"#(\d+)")


def classify(segment):
    if CREW_PEN.search(segment):
        return "crew"
    if DRIVER_PEN.search(segment):
        return "driver"
    return "other"


def short_phrase(segment):
    """Store a concise penalty_text: the matched keyword region, else first 8 words."""
    for rx in (CREW_PEN, DRIVER_PEN):
        m = rx.search(segment)
        if m:
            start = max(0, m.start() - 30)
            frag = segment[start:m.end() + 15]
            return " ".join(frag.split())[:80].strip(" ,.-")
    return " ".join(segment.split()[:8]).strip(" ,.-")


def parse_note(note_text):
    """v2: split each penalty-bearing sentence into per-car SEGMENTS (car mention ->
    next car mention) and classify on the FULL segment. Returns (pairs, unparsed);
    pairs = [(car, phrase, category, sentence)]."""
    pairs, unparsed = [], []
    sentences = re.split(r"(?<=[.!?])\s+", note_text or "")
    for sent in sentences:
        if not PEN_SENT.search(sent):
            continue
        found = []
        cars = list(CAR.finditer(sent))
        sent_generic = bool(GENERIC_PEN.search(sent))
        for i, m in enumerate(cars):
            seg_end = cars[i + 1].start() if i + 1 < len(cars) else len(sent)
            segment = sent[m.end():seg_end]
            cat = classify(segment)
            if cat != "other":
                found.append((m.group(1), short_phrase(segment), cat))
            elif sent_generic and GENERIC_PEN.search(segment):
                found.append((m.group(1), short_phrase(segment), "other"))
        if found:
            pairs.extend([(c, p, cat, sent.strip()) for (c, p, cat) in found])
        else:
            unparsed.append(sent.strip())
    return pairs, unparsed


# ---------------------------------------------------------------- race matching
def load_nascar_race_index(years):
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
                    "track": r.get("track_name"),
                    "date": d,
                })
        time.sleep(0.4)
    return idx


def match_race(row, idx, known):
    if row["id"] in known:
        return known[row["id"]], "pit_stops"
    sid = SERIES_TO_NASCAR[row["series"]]
    cands = idx.get((sid, row["year"]), [])
    rd = str(row.get("race_date") or "")[:10]
    if rd:
        try:
            d = datetime.fromisoformat(rd).date()
            hits = [c for c in cands if c["date"] and abs((c["date"] - d).days) <= 1]
            if len(hits) == 1:
                return hits[0]["nascar_race_id"], "date"
            if len(hits) > 1:
                t_hits = [c for c in hits if norm_track(c["track"]) == norm_track(row["track_name"])]
                if len(t_hits) == 1:
                    return t_hits[0]["nascar_race_id"], "date+track"
        except ValueError:
            pass
    return None, None


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", default="2026", help="season year, or 'all' for 2022-2026")
    ap.add_argument("--series", choices=["cup", "oreilly", "trucks"])
    ap.add_argument("--race-id", type=int, help="single PitBoard races.id")
    ap.add_argument("--dry-run", action="store_true", help="parse + report only; no DB writes")
    args = ap.parse_args()

    years = YEARS_ALL if args.year == "all" else [int(args.year)]

    rows = sb_get("races", "select=id,series,year,race_number,track_name,race_date,exhibition"
                           "&order=id.asc&limit=100000")
    races = [r for r in rows
             if r.get("year") in years and r["year"] >= 2022
             and not r.get("exhibition")
             and r.get("series") in SERIES_TO_NASCAR
             and (not args.series or r["series"] == args.series)
             and (not args.race_id or r["id"] == args.race_id)]
    print(f"{len(races)} points races in scope (years={years}, series={args.series or 'all'})")
    if not races:
        sys.exit("Nothing to do.")

    print("harvesting nascar_race_id map from pit_stops...")
    ps = sb_get_paged("pit_stops", "select=race_id,nascar_race_id")
    known = {}
    for p in ps:
        if p.get("race_id") and p.get("nascar_race_id"):
            known[p["race_id"]] = p["nascar_race_id"]
    print(f"  {len(known)} races already matched via pit_stops")

    need_idx = any(r["id"] not in known for r in races)
    idx = load_nascar_race_index(sorted({r["year"] for r in races})) if need_idx else {}

    totals = {"driver": 0, "crew": 0, "other": 0}
    all_unparsed, no_notes, loaded = [], [], 0

    for race in sorted(races, key=lambda r: (r["year"], r["series"], r.get("race_number") or 0)):
        label = f"{race['series']:>7} {race['year']} R{race.get('race_number')} {race['track_name']}"
        nrid, how = match_race(race, idx, known)
        if not nrid:
            print(f"  SKIP (no NASCAR match): {label}")
            continue
        sid = SERIES_TO_NASCAR[race["series"]]
        notes = get_json(f"{NASCAR}/cacher/{race['year']}/{sid}/{nrid}/lap-notes.json",
                         NASCAR_HEADERS, quiet=True)
        time.sleep(0.35)
        if not notes or not notes.get("laps"):
            no_notes.append(label)
            continue

        out, seen = [], set()
        for lap, items in (notes.get("laps") or {}).items():
            for n in (items or []):
                pairs, unparsed = parse_note(n.get("Note") or "")
                for sent in unparsed:
                    all_unparsed.append(f"{label} L{lap}: {sent[:160]}")
                for (car, phrase, cat, sent) in pairs:
                    key = (race["id"], int(lap) if str(lap).isdigit() else None, car, phrase.lower())
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append({
                        "race_id": race["id"], "nascar_race_id": nrid,
                        "series": race["series"], "year": race["year"],
                        "track_name": race["track_name"],
                        "race_number": race.get("race_number"),
                        "lap": int(lap) if str(lap).isdigit() else None,
                        "flag_state": n.get("FlagState"),
                        "car_number": car, "penalty_text": phrase.lower(),
                        "category": cat, "note_id": n.get("NoteID"),
                        "raw_note": sent[:400],
                    })
        for o in out:
            totals[o["category"]] += 1
        if args.dry_run:
            print(f"  DRY {label}: {len(out)} penalties "
                  f"({sum(1 for o in out if o['category']=='crew')} crew, "
                  f"{sum(1 for o in out if o['category']=='driver')} driver, "
                  f"{sum(1 for o in out if o['category']=='other')} other)")
        else:
            sb_delete("pit_penalties", f"race_id=eq.{race['id']}")
            if out:
                sb_insert("pit_penalties", out)
            print(f"  OK  {label}: {len(out)} penalties ({how}-matched)")
        loaded += 1

    print("\n================ SUMMARY ================")
    print(f"processed: {loaded} races | penalties: driver {totals['driver']}, "
          f"crew {totals['crew']}, other {totals['other']}")
    if no_notes:
        print(f"{len(no_notes)} races had no lap-notes feed")
    if all_unparsed:
        print(f"\n{len(all_unparsed)} penalty-flavored sentences produced NO parsed rows "
              f"(review; first 15):")
        for u in all_unparsed[:15]:
            print(f"  {u}")


if __name__ == "__main__":
    main()
