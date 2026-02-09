"""
Generate B-side names for the 41 non-SA cards.
GPK convention: alliterative "[Descriptor] [First Name]" puns.

For celebrity/band cards, the B-side should be a punny alternate take
on the same person/band, keeping the alliterative GPK format.
"""

import json
from pathlib import Path

PROJECT_DIR = Path(__file__).parent

# Hand-crafted B-side names for each card
# Format: card_name_a -> name_b
B_NAMES = {
    # ── PUNK ──
    "Mohawk Mike": "Spiked Spencer",
    "Thrash Travis": "Windmill Wally",
    "Studded Steve": "Riveted Randy",
    "Fiend Fred": "Crimson Craig",
    "Jello Jake": "Gelatin Gary",
    "Amplifier Andy": "Feedback Frankie",
    "Stage Dive Dan": "Crowdsurf Carl",
    "Mohican Mark": "Towering Tommy",
    "Danzig Danny": "Misfits Marvin",
    "Rancid Randy": "Decomposed Donnie",
    "Slam Dance Sam": "Moshing Murray",

    # ── GWAR ──
    "Oderus Icky": "Scumdog Scotty",
    "Splatter Sam": "Gore-Spray Gary",
    "Balsac Bobby": "Jawbone Jerry",
    "Sleazy Steve": "Slimethrone Seth",
    "Flattus Freddy": "Phantom Phil",
    "Jizmak Jake": "Skullkit Kenny",
    "Vulvatron Vicky": "Chrome Queen Connie",
    "Bonesnapper Brad": "Skeletal Sid",
    "Pustulus Paul": "Blister Bill",
    "Slymenstra Hymen": "Whiplash Wendy",
    "Costume Carnage Carl": "Wardrobe Wreck Wayne",

    # ── COMEDIANS ──
    "Mel Brooks": "Blazing Brooksie",
    "Rodney Dangerfield": "No-Respect Roddy",
    "Woody Allen": "Neurotic Ned",
    "Dom DeLuise": "Demolition Dom",
    "Gene Wilder": "Wilder Gene",
    "George Carlin": "Carlin's Curse Karl",
    "John Candy": "Candy Crash Johnny",
    "Andy Kaufman": "Kaufman Chaos Kenny",

    # ── BONUS ──
    "Monty Python": "Python Pileup Pete",
    "Kids in the Hall": "Hallway Havoc Hank",

    # ── MUSIC ──
    "Misfits Mike": "Devilock Danny",
    "Dead Kennedys": "Jello Jolt Jerry",
    "Dead Milkmen": "Mutant Moo Murray",
    "Devo Danny": "De-Evolved Dave",
    "Wesley Willis": "Headbutt Henry",
    "Ween Dean": "Boognish Bobby",
    "Mr. Bungle": "Masked Maniac Marty",
    "Primus Pete": "Fishbass Freddy",
    "Frank Zappa": "Zappa Zap Zack",
}


def main():
    manifest_path = PROJECT_DIR / "manifest.json"
    with open(manifest_path) as f:
        manifest = json.load(f)

    cards = manifest["cards"]
    updated = 0
    added = 0

    # Build lookup of existing cards by (seriesId, number, variant)
    card_index = {}
    for c in cards:
        key = (c.get("seriesId", ""), c["number"], c["variant"])
        card_index[key] = c

    new_cards = []

    for card in list(cards):
        if card.get("seriesId", "") == "sa":
            continue  # SA already has A+B
        if card["variant"] != "a":
            continue  # skip if somehow a B exists

        name_a = card["name"]
        name_b = B_NAMES.get(name_a)

        if not name_b:
            print(f"  WARNING: No B-name for {name_a}")
            continue

        # Update the A card with other_name
        card["other_name"] = name_b
        updated += 1

        # Check if B card already exists
        b_key = (card.get("seriesId", ""), card["number"], "b")
        if b_key in card_index:
            # Update existing B card
            card_index[b_key]["other_name"] = name_a
            continue

        # Create B card entry
        b_card = {
            "number": card["number"],
            "variant": "b",
            "name": name_b,
            "other_name": name_a,
            "raw": None,       # No image yet — needs generation
            "framed": None,
            "status": "pending",
            "seriesId": card.get("seriesId", ""),
            "description": card.get("description", ""),
        }
        new_cards.append(b_card)
        added += 1

    # Insert B cards right after their A cards
    final_cards = []
    for card in cards:
        final_cards.append(card)
        if card.get("seriesId", "") != "sa" and card["variant"] == "a":
            # Find matching new B card
            for bc in new_cards:
                if bc["seriesId"] == card.get("seriesId", "") and bc["number"] == card["number"]:
                    final_cards.append(bc)
                    break

    manifest["cards"] = final_cards

    # Save
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nUpdated {updated} A-cards with other_name")
    print(f"Added {added} new B-card entries")
    print(f"Total cards now: {len(final_cards)}")
    print(f"Manifest saved: {manifest_path}")


if __name__ == "__main__":
    main()
