#!/usr/bin/env python3
"""Re-sync the vendored exercise catalog from the WorkoutX API.

Writes two files that the app imports directly — there is no exercise API at
runtime:

  src/db/exercises.json     canonical rows; `name` is the DB join key
  src/db/exercises.es.json  { id: {...} } Spanish display overlay

The free plan caps a page at 10 items (`limit` is ignored) and 30 req/min, so a
full sync is ~266 requests and takes about 10 minutes.

Usage:
    WORKOUTX_API_KEY=wx_... python3 scripts/sync-exercises.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter

KEY = os.environ.get("WORKOUTX_API_KEY", "").strip()
if not KEY:
    sys.exit("WORKOUTX_API_KEY is not set. See .env.example.")

BASE = "https://api.workoutxapp.com/v1/exercises"
PAGE = 10      # free plan hard cap
SLEEP = 2.2    # stay under 30 req/min
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KEEP = ("id", "name", "bodyPart", "equipment", "target", "secondaryMuscles",
        "instructions", "category", "difficulty", "mechanic", "force")
KEEP_ES = ("name", "bodyPart", "equipment", "target", "secondaryMuscles",
           "instructions")


def get(offset, lang=None, attempt=0):
    url = f"{BASE}?offset={offset}" + (f"&lang={lang}" if lang else "")
    req = urllib.request.Request(url, headers={"X-WorkoutX-Key": KEY})
    try:
        with urllib.request.urlopen(req, timeout=90) as f:
            return json.load(f), f.headers.get("X-Quota-Remaining")
    except urllib.error.HTTPError as e:
        if e.code in (429, 500, 502, 503) and attempt < 4:
            wait = 15 * (attempt + 1)
            print(f"  HTTP {e.code} at offset {offset}; waiting {wait}s", flush=True)
            time.sleep(wait)
            return get(offset, lang, attempt + 1)
        raise


def fetch_all(lang):
    label = lang or "en"
    first, quota = get(0, lang)
    total = first["total"]
    rows = list(first["data"])
    pages = -(-total // PAGE)
    print(f"[{label}] total={total} pages={pages} quota_left={quota}", flush=True)

    for i, offset in enumerate(range(PAGE, total, PAGE), start=2):
        time.sleep(SLEEP)
        d, quota = get(offset, lang)
        rows.extend(d["data"])
        if i % 20 == 0 or i == pages:
            print(f"[{label}] page {i}/{pages}  rows={len(rows)}  "
                  f"quota_left={quota}", flush=True)
    return rows, quota


def main():
    t0 = time.time()
    en_rows, _ = fetch_all(None)
    es_rows, quota = fetch_all("es")

    # Collapse duplicate names — the app keys exercises by name.
    by_name, dupes = {}, []
    for r in en_rows:
        slim = {k: r.get(k) for k in KEEP if r.get(k) not in (None, "", [])}
        key = slim["name"].strip().lower()
        if key in by_name:
            dupes.append(slim["name"])
            continue
        by_name[key] = slim
    canonical = sorted(by_name.values(), key=lambda e: e["name"].lower())
    kept = {e["id"] for e in canonical}

    es = {
        r["id"]: {k: r.get(k) for k in KEEP_ES if r.get(k) not in (None, "", [])}
        for r in es_rows
        if r["id"] in kept
    }

    for path, data in ((f"{ROOT}/src/db/exercises.json", canonical),
                       (f"{ROOT}/src/db/exercises.es.json", es)):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"wrote {path}  {os.path.getsize(path) / 1024:.0f} KB", flush=True)

    en_by_id = {e["id"]: e for e in canonical}
    translated = sum(1 for i, v in es.items()
                     if v.get("name") and v["name"] != en_by_id[i]["name"])
    print(f"\ncanonical : {len(canonical)} exercises "
          f"({len(dupes)} duplicate names dropped)")
    print(f"with instructions: {sum(1 for e in canonical if e.get('instructions'))}")
    print(f"es overlay: {len(es)}  names translated: {translated}")
    if dupes:
        print(f"dupe names: {[n for n, _ in Counter(dupes).most_common(8)]}")
    print(f"quota_left: {quota}   elapsed: {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
