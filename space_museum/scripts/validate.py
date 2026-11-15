"""
Validates data/missions.json and data/knowledge.json.

  python scripts/validate.py --partial   # while still adding missions
  python scripts/validate.py             # strict, before handoff
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
PLANETS = {"moon", "mars"}
PLANET_OF = {"eagle": "moon", "surveyor3": "moon", "apollo15_lrv": "moon",
             "sojourner": "mars", "spirit": "mars", "opportunity": "mars"}
MISSIONS = set(PLANET_OF)
CHAPTERS = ["mission", "machine", "journey", "discoveries", "what_remains"]

partial = "--partial" in sys.argv
errors, warnings = [], []

data = json.loads((DATA / "missions.json").read_text(encoding="utf-8"))
know = json.loads((DATA / "knowledge.json").read_text(encoding="utf-8"))


def url_problem(url, where):
    if not url.startswith("https://"):
        errors.append(f"{where}: bad url {url!r}")
    elif "TODO" in url:
        (warnings if partial else errors).append(f"{where}: placeholder url, replace with the real NASA page")


if {p["id"] for p in data["planets"]} != PLANETS:
    errors.append("planet ids must be exactly: moon, mars")

ids = [m["id"] for m in data["missions"]]
if len(ids) != len(set(ids)):
    errors.append("duplicate mission ids")
if not set(ids) <= MISSIONS:
    errors.append(f"unknown mission ids: {set(ids) - MISSIONS}")
if not partial and set(ids) != MISSIONS:
    errors.append(f"missing missions: {MISSIONS - set(ids)}")

orders = {}
for m in data["missions"]:
    mid = m["id"]
    if PLANET_OF.get(mid) != m["planet"]:
        errors.append(f"{mid}: planet should be {PLANET_OF.get(mid)}, got {m['planet']}")
    orders.setdefault(m["planet"], []).append(m["tour_order"])
    if [c["id"] for c in m["chapters"]] != CHAPTERS:
        errors.append(f"{mid}: chapters must be {CHAPTERS} in this order")
    for c in m["chapters"]:
        tag = f"{mid}/{c['id']}"
        for f in ("title", "summary", "narration_text"):
            v = c.get(f, "").strip()
            if not v or v.upper().startswith("TODO"):
                errors.append(f"{tag}: {f} empty or TODO")
        words = len(c.get("narration_text", "").split())
        if not 20 <= words <= 55:
            errors.append(f"{tag}: narration is {words} words (target 25-45)")
        if not c.get("sources"):
            errors.append(f"{tag}: no sources")
        for s in c.get("sources", []):
            url_problem(s["url"], tag)

for planet, o in orders.items():
    if sorted(o) != list(range(1, len(o) + 1)):
        errors.append(f"{planet}: tour_order must be 1..n, got {sorted(o)}")

if know:
    if len({len(k["embedding"]) for k in know}) != 1:
        errors.append("embedding sizes differ")
chunk_ids = [k["chunk_id"] for k in know]
if len(chunk_ids) != len(set(chunk_ids)):
    errors.append("duplicate chunk_id values")
for k in know:
    if k["artifact_id"] not in MISSIONS:
        errors.append(f"chunk {k['chunk_id']}: unknown artifact_id {k['artifact_id']}")
    if k["chapter_id"] not in CHAPTERS:
        errors.append(f"chunk {k['chunk_id']}: unknown chapter_id {k['chapter_id']}")
    url_problem(k["url"], f"chunk {k['chunk_id']}")

for mid in (set(ids) if partial else MISSIONS):
    n = sum(k["artifact_id"] == mid for k in know)
    if n < 3:
        errors.append(f"{mid}: only {n} chunks (want 5+)")
    elif n < 5:
        warnings.append(f"{mid}: {n} chunks (5+ gives better answers)")

if warnings:
    print("WARNINGS:\n  " + "\n  ".join(warnings))
print("ERRORS:\n  " + "\n  ".join(errors) if errors else "ALL GOOD")
sys.exit(1 if errors else 0)