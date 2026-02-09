"""
Generate GPK-style A/B name pairs for all 500 suggestions.
Pattern: [Descriptor] [First Name] with alliteration.
Both names reference the same concept from different angles.
"""
import json
import random
import re
from pathlib import Path

random.seed(42)  # Reproducible

# ── First names grouped by starting letter ──
NAMES = {
    'A': ['Adam', 'Alice', 'Archie', 'Andy', 'Annie', 'Artie', 'Ava', 'Axel', 'Arlo', 'Ash'],
    'B': ['Blake', 'Bella', 'Brent', 'Bonnie', 'Brad', 'Beth', 'Bruno', 'Bryce', 'Bobby', 'Barb'],
    'C': ['Chad', 'Clara', 'Carl', 'Cora', 'Clyde', 'Carla', 'Cruz', 'Cliff', 'Chet', 'Cassie'],
    'D': ['Dan', 'Dee', 'Drew', 'Darla', 'Duke', 'Dawn', 'Dirk', 'Deb', 'Donnie', 'Dale'],
    'E': ['Ed', 'Eve', 'Earl', 'Elsa', 'Ernie', 'Ella', 'Eli', 'Emmy', 'Emmett', 'Edith'],
    'F': ['Frank', 'Faye', 'Fred', 'Flora', 'Fritz', 'Fern', 'Flip', 'Flo', 'Flynn', 'Faith'],
    'G': ['Greg', 'Gail', 'Gus', 'Grace', 'Glen', 'Greta', 'Grant', 'Gemma', 'Gage', 'Gwen'],
    'H': ['Hank', 'Hazel', 'Herb', 'Holly', 'Hugo', 'Hope', 'Hector', 'Helen', 'Hal', 'Heath'],
    'I': ['Ivan', 'Ivy', 'Ike', 'Irma', 'Ian', 'Iris', 'Igor', 'Ida', 'Izzy', 'Inez'],
    'J': ['Jake', 'Jane', 'Jim', 'Jill', 'Joel', 'Joy', 'Jules', 'Jean', 'Jude', 'June'],
    'K': ['Kyle', 'Kate', 'Kurt', 'Kim', 'Kirk', 'Kay', 'Kent', 'Kara', 'Knox', 'Kris'],
    'L': ['Lee', 'Liz', 'Lou', 'Luna', 'Lance', 'Lena', 'Lars', 'Lily', 'Luke', 'Lacey'],
    'M': ['Mike', 'Meg', 'Mack', 'Mona', 'Max', 'Maude', 'Miles', 'Millie', 'Mort', 'Mae'],
    'N': ['Ned', 'Nell', 'Nick', 'Nora', 'Nash', 'Nina', 'Nigel', 'Nan', 'Nate', 'Nadine'],
    'O': ['Otto', 'Olive', 'Oscar', 'Opal', 'Otis', 'Ora', 'Owen', 'Olga', 'Ozzy', 'Oona'],
    'P': ['Pat', 'Peg', 'Paul', 'Pearl', 'Pete', 'Polly', 'Phil', 'Penny', 'Pierce', 'Pam'],
    'Q': ['Quinn', 'Queenie'],
    'R': ['Ray', 'Rose', 'Rob', 'Rita', 'Rex', 'Ruby', 'Ralph', 'Rae', 'Rudy', 'Rhoda'],
    'S': ['Sam', 'Sue', 'Sid', 'Sally', 'Stan', 'Stella', 'Shane', 'Sara', 'Slick', 'Shel'],
    'T': ['Tom', 'Tess', 'Ted', 'Tina', 'Troy', 'Trudy', 'Trent', 'Tammy', 'Todd', 'Trish'],
    'U': ['Ursula', 'Ulysses', 'Uma', 'Upton'],
    'V': ['Vern', 'Val', 'Vic', 'Vera', 'Vince', 'Violet', 'Van', 'Velma', 'Virgil', 'Vi'],
    'W': ['Walt', 'Wendy', 'Wes', 'Wanda', 'Wayne', 'Wilma', 'Wren', 'Wade', 'Wally', 'Winnie'],
    'X': ['Xavier', 'Xena'],
    'Y': ['Yuri', 'Yvette', 'Yves', 'Yvonne'],
    'Z': ['Zed', 'Zelda', 'Zeke', 'Zara', 'Zack', 'Zola'],
}

# ── Gross/GPK-style descriptors by theme ──
DESCRIPTORS = {
    # Suburban / HOA
    'suburban': ['Lawn-Rot', 'Cul-de-Sac', 'Driveway', 'Curbside', 'Vinyl-Siding', 'Subdivision',
                 'Sprinkler', 'HOA', 'Yard-Waste', 'Garage-Sale', 'Fence-Line', 'Sidewalk'],
    'bureaucracy': ['Paperwork', 'Fine-Print', 'Red-Tape', 'Permit', 'Code-Violation', 'Clipboard',
                    'Filing', 'Rubber-Stamp', 'Notice', 'Form-Letter', 'Compliance', 'Ordinance'],
    # Social media / influencer
    'platform': ['Algorithm', 'Feed-Scroll', 'Content', 'Viral', 'Trending', 'Clickbait',
                 'Pixel', 'Upload', 'Buffering', 'Notification', 'Timeline', 'Cached'],
    'fame': ['Follower', 'Clout', 'Verified', 'Sponsored', 'Famous', 'Cancel', 'Ratio',
             'Brand-Deal', 'Unboxing', 'Collab', 'Filter-Face', 'Influenza'],
    # Horror
    'body-horror': ['Skin-Peel', 'Bone-Crack', 'Gut-Rot', 'Skull-Split', 'Eye-Pop', 'Flesh-Melt',
                    'Spine-Snap', 'Rib-Cage', 'Organ', 'Sinew', 'Cartilage', 'Marrow'],
    'gross-out': ['Slime', 'Ooze', 'Pus', 'Crud', 'Muck', 'Gunk', 'Drool', 'Snot', 'Phlegm',
                  'Bile', 'Scab', 'Blister', 'Fungus', 'Mildew', 'Rancid', 'Putrid'],
    # Media / entertainment
    'media': ['Screen-Burn', 'Static', 'Rerun', 'Channel', 'Broadcast', 'Deleted-Scene',
              'Laugh-Track', 'Ratings', 'Primetime', 'Cancelled', 'Pilot', 'Syndicated'],
    # Sci-fi
    'technology': ['Glitch', 'Malware', 'Crash', 'Debug', 'Lag', 'Corrupted', 'Overclocked',
                   'Bricked', 'Rebooted', 'Patched', 'Firmware', 'Blue-Screen'],
    # Power / politics
    'power': ['Ballot', 'Filibuster', 'Campaign', 'Lobby', 'Gerrymander', 'Caucus', 'Stump',
              'Landslide', 'Incumbent', 'Term-Limit', 'Primary', 'Debate'],
    # Mythology
    'nostalgia': ['Vintage', 'Retro', 'Throwback', 'Reboot', 'Classic', 'Old-School',
                  'Antique', 'Relic', 'Fossil', 'Bygone', 'Faded', 'Dusty'],
    # Monster
    'biology': ['Mutant', 'Hybrid', 'Spliced', 'Evolved', 'Feral', 'Parasitic',
                'Venomous', 'Toxic', 'Radioactive', 'Infected', 'Metamorphic', 'Spore'],
    # Catch-all
    'default': ['Crusty', 'Mangled', 'Shattered', 'Twisted', 'Warped', 'Busted', 'Gnarly',
                'Wrecked', 'Trashed', 'Smashed', 'Crumbled', 'Moldy', 'Rusty', 'Squishy'],
}

# Series-specific descriptor themes
SERIES_THEMES = {
    'Suburban Apocalypse': ['suburban', 'bureaucracy', 'gross-out'],
    'Influencer Wasteland': ['platform', 'fame', 'gross-out'],
    'TikTok Terrors': ['platform', 'fame', 'body-horror'],
    'Reality Ruination': ['media', 'fame', 'gross-out'],
    'Hollywood Has-Beens': ['media', 'nostalgia', 'body-horror'],
    'Horror Classics Parodies': ['body-horror', 'gross-out', 'default'],
    'Sci-Fi Future Misfits': ['technology', 'biology', 'gross-out'],
    'Election Trash Talk': ['power', 'bureaucracy', 'gross-out'],
    'Mythical Mayhem': ['nostalgia', 'biology', 'default'],
    'Cabbage Patch Rejects': ['gross-out', 'default', 'biology'],
    'Monster Mash-Up': ['biology', 'body-horror', 'default'],
}

def extract_keywords(title, pitch):
    """Pull usable words from title and pitch."""
    words = set()
    # Title words
    for w in re.split(r'[\s\-]+', title):
        w = w.strip("'\".,!?").capitalize()
        if len(w) >= 3:
            words.add(w)
    # Key pitch words (nouns/adjectives)
    skip = {'the', 'and', 'when', 'that', 'this', 'with', 'from', 'into', 'via', 'for',
            'its', 'are', 'has', 'was', 'but', 'not', 'all', 'can', 'will', 'just',
            'than', 'been', 'each', 'than', 'only', 'very', 'every', 'becomes', 'turns',
            'arrives', 'hostile', 'normal', 'visual', 'motifs', 'style', 'card',
            'illustration', 'detail', 'comedic', 'horror', 'gross', 'trading'}
    for w in pitch.split():
        w = w.strip("'\".,!?;:()").lower()
        if len(w) >= 4 and w not in skip:
            words.add(w.capitalize())
    return list(words)

def make_descriptor(title, pitch, series, used_descriptors):
    """Create a GPK-style descriptor from the card concept."""
    themes = SERIES_THEMES.get(series, ['default', 'gross-out'])
    
    # Build pool from themes
    pool = []
    for theme in themes:
        pool.extend(DESCRIPTORS.get(theme, []))
    pool.extend(DESCRIPTORS['default'])
    
    # Also try to make descriptors from title words
    title_words = title.split()
    for w in title_words:
        w = w.strip("'-")
        if len(w) >= 3:
            pool.append(w.capitalize())
            # Compound variations
            for suffix in ['-Rot', '-Melt', '-Face', '-Mouth', '-Brain', '-Gut']:
                pool.append(w.capitalize() + suffix)
    
    # Filter out already-used ones
    pool = [d for d in pool if d not in used_descriptors]
    if not pool:
        pool = DESCRIPTORS['default'][:]
    
    chosen = random.choice(pool)
    used_descriptors.add(chosen)
    return chosen

def pick_name(letter, used_names):
    """Pick a first name starting with given letter."""
    letter = letter.upper()
    candidates = NAMES.get(letter, NAMES['Z'])
    available = [n for n in candidates if n not in used_names]
    if not available:
        available = candidates  # Reuse if exhausted
    chosen = random.choice(available)
    used_names.add(chosen)
    return chosen

def generate_pair(suggestion, used_a, used_b, used_names):
    """Generate A/B name pair for a suggestion."""
    title = suggestion['title']
    pitch = suggestion['pitch']
    series = suggestion['series']
    keywords = extract_keywords(title, pitch)
    
    # Name A: descriptor from title concept + alliterative name
    desc_a = make_descriptor(title, pitch, series, used_a)
    letter_a = desc_a[0].upper()
    name_a_first = pick_name(letter_a, used_names)
    name_a = f"{desc_a} {name_a_first}"
    
    # Name B: different angle on same concept
    desc_b = make_descriptor(title, pitch, series, used_b)
    letter_b = desc_b[0].upper()
    name_b_first = pick_name(letter_b, used_names)
    name_b = f"{desc_b} {name_b_first}"
    
    # Avoid identical starting letters if possible (variety is better)
    attempts = 0
    while letter_a == letter_b and attempts < 3:
        desc_b = make_descriptor(title, pitch, series, used_b)
        letter_b = desc_b[0].upper()
        name_b_first = pick_name(letter_b, used_names)
        name_b = f"{desc_b} {name_b_first}"
        attempts += 1
    
    return name_a, name_b

def main():
    src = Path(r"C:\Users\PC\Desktop\projects\garbagepalkids\web\suggestions.json")
    data = json.loads(src.read_text(encoding='utf-8'))
    
    used_a = set()
    used_b = set()
    used_names = set()
    
    for s in data['suggestions']:
        name_a, name_b = generate_pair(s, used_a, used_b, used_names)
        s['name_a'] = name_a
        s['name_b'] = name_b
    
    # Write back
    src.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    
    # Print samples
    print(f"Generated A/B names for {len(data['suggestions'])} suggestions\n")
    print(f"{'Series':<25} {'Title':<25} {'Name A':<25} {'Name B':<25}")
    print("-" * 100)
    for s in data['suggestions'][:30]:
        print(f"{s['series']:<25} {s['title']:<25} {s['name_a']:<25} {s['name_b']:<25}")
    print("...")

if __name__ == '__main__':
    main()
