#!/usr/bin/env python3
"""Build multi-series manifest.json from SA manifest + GPK cards."""
import json, os

# Load existing SA manifest (backup first)
with open('manifest.json') as f:
    sa = json.load(f)

# Handle both old single-series format and already-converted format
if 'collections' in sa:
    # Already converted — grab cards that are SA
    sa_cards = [c for c in sa['cards'] if c.get('seriesId') == 'sa']
else:
    sa_cards = sa.get('cards', [])

# Add seriesId to all existing SA cards
for card in sa_cards:
    card['seriesId'] = 'sa'

# Define collections
collections = [
    {"id": "sa", "name": "Suburban Apocalypse", "prefix": "SA",
     "description": "Suburban nightmares rendered in GPK cartoon style"},
    {"id": "punk", "name": "Punk", "prefix": "PK",
     "description": "Punk rock originals"},
    {"id": "gwar", "name": "GWAR", "prefix": "GW",
     "description": "Intergalactic shock-rock warriors"},
    {"id": "comedians", "name": "Comedians", "prefix": "CM",
     "description": "Comedy legends, GPK style"},
    {"id": "bonus", "name": "Bonus", "prefix": "BN",
     "description": "Bonus comedy troupe cards"},
    {"id": "music", "name": "Music", "prefix": "MU",
     "description": "Musical misfits and weirdos"},
]

# GPK card definitions: (number, name, seriesId)
gpk_cards = [
    # Punk 01-11
    (1, "Mohawk Mike", "punk"),
    (2, "Thrash Travis", "punk"),
    (3, "Studded Steve", "punk"),
    (4, "Fiend Fred", "punk"),
    (5, "Jello Jake", "punk"),
    (6, "Amplifier Andy", "punk"),
    (7, "Stage Dive Dan", "punk"),
    (8, "Mohican Mark", "punk"),
    (9, "Danzig Danny", "punk"),
    (10, "Rancid Randy", "punk"),
    (11, "Slam Dance Sam", "punk"),
    # GWAR 12-22
    (12, "Oderus Icky", "gwar"),
    (13, "Splatter Sam", "gwar"),
    (14, "Balsac Bobby", "gwar"),
    (15, "Sleazy Steve", "gwar"),
    (16, "Flattus Freddy", "gwar"),
    (17, "Jizmak Jake", "gwar"),
    (18, "Vulvatron Vicky", "gwar"),
    (19, "Bonesnapper Brad", "gwar"),
    (20, "Pustulus Paul", "gwar"),
    (21, "Slymenstra Hymen", "gwar"),
    (22, "Costume Carnage Carl", "gwar"),
    # Comedians 23-30
    (23, "Mel Brooks", "comedians"),
    (24, "Rodney Dangerfield", "comedians"),
    (25, "Woody Allen", "comedians"),
    (26, "Dom DeLuise", "comedians"),
    (27, "Gene Wilder", "comedians"),
    (28, "George Carlin", "comedians"),
    (29, "John Candy", "comedians"),
    (30, "Andy Kaufman", "comedians"),
    # Bonus 31-32
    (31, "Monty Python", "bonus"),
    (32, "Kids in the Hall", "bonus"),
    # Music 33-41
    (33, "Misfits Mike", "music"),
    (34, "Dead Kennedys", "music"),
    (35, "Dead Milkmen", "music"),
    (36, "Devo Danny", "music"),
    (37, "Wesley Willis", "music"),
    (38, "Ween Dean", "music"),
    (39, "Mr. Bungle", "music"),
    (40, "Primus Pete", "music"),
    (41, "Frank Zappa", "music"),
]

# Check which GPK images exist
gpk_dir = "cards/gpk"
existing_files = set()
if os.path.exists(gpk_dir):
    existing_files = set(os.listdir(gpk_dir))

new_cards = []
for num, name, series_id in gpk_cards:
    slug = name.lower().replace(" ", "_").replace(".", "").replace("'", "")
    filename = f"{num:02d}_{slug}.png"
    raw_path = f"{gpk_dir}/{filename}"
    has_image = filename in existing_files
    new_cards.append({
        "number": num,
        "variant": "a",
        "name": name,
        "other_name": None,
        "raw": raw_path if has_image else None,
        "framed": None,
        "status": "generated" if has_image else "pending",
        "seriesId": series_id,
    })

# Combine
all_cards = sa_cards + new_cards

manifest = {
    "generated": "2026-02-07",
    "collections": collections,
    "cards": all_cards,
}

with open("manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

# Stats
by_series = {}
for c in all_cards:
    s = c.get("seriesId", "unknown")
    by_series.setdefault(s, {"total": 0, "with_image": 0})
    by_series[s]["total"] += 1
    if c.get("raw"):
        by_series[s]["with_image"] += 1

for sid, info in sorted(by_series.items()):
    print(f"  {sid}: {info['with_image']}/{info['total']} cards with images")
print(f"Total: {len(all_cards)} cards in manifest")
