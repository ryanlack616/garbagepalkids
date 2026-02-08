"""
Build a unified manifest.json with all series/collections.
Reads existing SA manifest + GPK framed cards and outputs multi-collection format.
"""
import json
import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent
OLD_MANIFEST = ROOT / "web" / "manifest.json"
GPK_DIR = ROOT / "cards" / "gpk"
OUT = ROOT / "web" / "manifest.json"

# Series definitions matching frame_gpk.py
SERIES = [
    {"id": "sa", "name": "Suburban Apocalypse", "prefix": "SA", "range": None},
    {"id": "punk", "name": "Punk Legends", "prefix": "PK", "range": range(1, 12)},
    {"id": "gwar", "name": "GWAR Warriors", "prefix": "GW", "range": range(12, 23)},
    {"id": "comedy", "name": "Comedy Icons", "prefix": "CI", "range": range(23, 33)},
    {"id": "music", "name": "Musical Misfits", "prefix": "MM", "range": range(33, 42)},
]


def prettify_name(filename: str) -> str:
    name = re.sub(r'^\d+_', '', filename)
    name = name.replace('_', ' ')
    return name.title()


def get_series_id(num: int) -> str:
    for s in SERIES:
        if s["range"] and num in s["range"]:
            return s["id"]
    return "sa"


def main():
    # Load existing SA cards only
    old = json.load(open(OLD_MANIFEST))
    all_old = old.get("cards", [])
    sa_cards = [c for c in all_old if c.get("seriesId", "sa") == "sa" and "GPK-" not in c.get("raw", "")]

    # Tag SA cards with seriesId, update paths to WebP
    for c in sa_cards:
        c["seriesId"] = "sa"
        if c.get("framed", "").endswith(".png"):
            c["framed"] = c["framed"].replace(".png", ".webp")

    # Build GPK cards from framed files
    gpk_files = sorted(GPK_DIR.glob("*.webp"))
    gpk_cards = []
    for f in gpk_files:
        num = int(re.match(r'(\d+)', f.stem).group(1))
        name = prettify_name(f.stem)
        safe_name = name.lower().replace(' ', '-').replace("'", "")
        series_id = get_series_id(num)

        gpk_cards.append({
            "number": num,
            "name": name,
            "seriesId": series_id,
            "raw": f"cards/GPK-{num:02d}_{safe_name}.png",
            "framed": f"cards/framed/GPK-{num:02d}_{safe_name}_framed.webp",
            "status": "framed"
        })

    # Build collections
    collections = []
    for s in SERIES:
        sid = s["id"]
        if sid == "sa":
            count = len(sa_cards)
        else:
            count = len([c for c in gpk_cards if c["seriesId"] == sid])
        collections.append({
            "id": sid,
            "name": s["name"],
            "prefix": s["prefix"],
            "count": count
        })

    all_cards = sa_cards + gpk_cards

    manifest = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "collections": collections,
        "cards": all_cards
    }

    with open(OUT, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest written: {len(all_cards)} total cards")
    for col in collections:
        print(f"  {col['prefix']} - {col['name']}: {col['count']} cards")


if __name__ == "__main__":
    main()
