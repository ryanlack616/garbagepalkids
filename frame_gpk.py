"""
Batch frame all GPK cards from cards/gpk/ into cards/framed/ and web/cards/framed/.
Adapts the SA compose pipeline for the other series (Punk, GWAR, Comedians, Music).
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

CARDS_DIR = Path(__file__).parent / "cards" / "gpk"
FRAMED_DIR = Path(__file__).parent / "cards" / "framed"
WEB_FRAMED_DIR = Path(__file__).parent / "web" / "cards" / "framed"
WEB_RAW_DIR = Path(__file__).parent / "web" / "cards"

FRAMED_DIR.mkdir(parents=True, exist_ok=True)
WEB_FRAMED_DIR.mkdir(parents=True, exist_ok=True)
WEB_RAW_DIR.mkdir(parents=True, exist_ok=True)

# Card dimensions
CARD_WIDTH = 750
CARD_HEIGHT = 1050
BORDER_WIDTH = 24
INNER_PADDING = 12
ART_TOP = 100
ART_BOTTOM = 160
CORNER_RADIUS = 20

# Colors
BORDER_COLOR = (30, 30, 30)
BANNER_BG = (20, 20, 20, 230)
TITLE_COLOR = (255, 220, 50)
SUBTITLE_COLOR = (200, 200, 200)
SERIES_COLOR = (150, 200, 255)
DRIP_COLORS = [
    (0, 200, 80),
    (200, 50, 200),
    (255, 100, 50),
    (50, 200, 255),
]

# Series definitions
SERIES_MAP = {
    range(1, 12): ("Punk Legends", "PK"),
    range(12, 23): ("GWAR Warriors", "GW"),
    range(23, 33): ("Comedy Icons", "CI"),
    range(33, 42): ("Musical Misfits", "MM"),
}


def get_series(num: int) -> tuple[str, str]:
    for r, (name, prefix) in SERIES_MAP.items():
        if num in r:
            return name, prefix
    return "Bonus", "BX"


def get_font(size: int, bold: bool = False):
    candidates = [
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def draw_drip_effect(draw, y, width, color, count=8):
    import random
    rng = random.Random(hash(color) + y)
    for _ in range(count):
        x = rng.randint(BORDER_WIDTH, width - BORDER_WIDTH)
        drip_w = rng.randint(6, 18)
        drip_h = rng.randint(12, 40)
        draw.ellipse([x - drip_w // 2, y - 4, x + drip_w // 2, y + drip_h], fill=color)
        if rng.random() > 0.5:
            sx = x + rng.randint(-20, 20)
            sy = y + drip_h + rng.randint(4, 16)
            sr = rng.randint(2, 5)
            draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=color)


def prettify_name(filename: str) -> str:
    """Convert '01_mohawk_mike' to 'Mohawk Mike'."""
    name = re.sub(r'^\d+_', '', filename)
    name = name.replace('_', ' ')
    return name.title()


def frame_card(art_path: Path, number: int, name: str, series_name: str, prefix: str) -> Path:
    """Frame a single card image."""
    art = Image.open(art_path).convert("RGBA")

    art_area_w = CARD_WIDTH - 2 * (BORDER_WIDTH + INNER_PADDING)
    art_area_h = CARD_HEIGHT - ART_TOP - ART_BOTTOM - 2 * INNER_PADDING
    art = art.resize((art_area_w, art_area_h), Image.LANCZOS)

    card = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)

    # Outer card
    draw.rounded_rectangle(
        [0, 0, CARD_WIDTH - 1, CARD_HEIGHT - 1],
        CORNER_RADIUS, fill=(40, 40, 40), outline=BORDER_COLOR, width=BORDER_WIDTH,
    )

    # Art area
    art_x = BORDER_WIDTH + INNER_PADDING
    art_y = ART_TOP
    draw.rectangle(
        [art_x - 2, art_y - 2, art_x + art_area_w + 2, art_y + art_area_h + 2],
        fill=(0, 0, 0), outline=(60, 60, 60), width=2,
    )
    card.paste(art, (art_x, art_y), art)

    # Drips
    drip_color = DRIP_COLORS[number % len(DRIP_COLORS)]
    draw_drip_effect(draw, art_y + art_area_h, CARD_WIDTH, drip_color, count=10)

    # Top banner
    font_number = get_font(28, bold=True)
    font_series = get_font(18)

    # Number badge
    draw.rounded_rectangle(
        [BORDER_WIDTH + 8, 12, BORDER_WIDTH + 80, 50],
        radius=8, fill=(200, 40, 40), outline=(255, 255, 255), width=2,
    )
    draw.text(
        (BORDER_WIDTH + 44, 31), f"#{number}",
        fill=(255, 255, 255), font=font_number, anchor="mm",
    )

    # Series name
    draw.text(
        (CARD_WIDTH // 2, 36), series_name.upper(),
        fill=SERIES_COLOR, font=font_series, anchor="mm",
    )

    # Prefix badge
    draw.rounded_rectangle(
        [CARD_WIDTH - BORDER_WIDTH - 70, 12, CARD_WIDTH - BORDER_WIDTH - 8, 50],
        radius=8, fill=(40, 40, 120), outline=(255, 255, 255), width=2,
    )
    draw.text(
        (CARD_WIDTH - BORDER_WIDTH - 39, 31), prefix,
        fill=(255, 255, 255), font=font_number, anchor="mm",
    )

    # Bottom banner
    banner_y = CARD_HEIGHT - ART_BOTTOM
    banner = Image.new("RGBA", (CARD_WIDTH, ART_BOTTOM), (0, 0, 0, 0))
    banner_draw = ImageDraw.Draw(banner)
    banner_draw.rounded_rectangle(
        [BORDER_WIDTH + 4, 8, CARD_WIDTH - BORDER_WIDTH - 4, ART_BOTTOM - BORDER_WIDTH],
        radius=12, fill=BANNER_BG,
    )
    card.paste(banner, (0, banner_y), banner)
    draw = ImageDraw.Draw(card)

    # Title
    font_title = get_font(44, bold=True)
    font_footer = get_font(14)

    draw.text(
        (CARD_WIDTH // 2, banner_y + 50), name.upper(),
        fill=TITLE_COLOR, font=font_title, anchor="mm",
        stroke_width=3, stroke_fill=(0, 0, 0),
    )

    # Series subtitle
    draw.text(
        (CARD_WIDTH // 2, banner_y + 90), series_name,
        fill=SUBTITLE_COLOR, font=get_font(22), anchor="mm",
    )

    # Footer
    draw.text(
        (CARD_WIDTH // 2, CARD_HEIGHT - BORDER_WIDTH - 12),
        f"GARBAGE PAL KIDS: {series_name.upper()}  |  Generated with Flux AI",
        fill=(100, 100, 100), font=font_footer, anchor="mm",
    )

    # Save
    card_rgb = Image.new("RGB", card.size, (30, 30, 30))
    card_rgb.paste(card, mask=card.split()[3])

    safe_name = name.lower().replace(' ', '-').replace("'", "")
    out_filename = f"GPK-{number:02d}_{safe_name}_framed.png"
    out_path = FRAMED_DIR / out_filename
    card_rgb.save(str(out_path), "PNG", quality=95)

    # Also save to web/cards/framed/
    web_out = WEB_FRAMED_DIR / out_filename
    card_rgb.save(str(web_out), "PNG", quality=95)

    return out_path


def main():
    files = sorted(CARDS_DIR.glob("*.webp"))
    print(f"Found {len(files)} GPK cards to frame\n")

    # Also copy raw cards to web/cards/ as PNG for the site
    for f in files:
        number = int(re.match(r'(\d+)', f.stem).group(1))
        name = prettify_name(f.stem)
        series_name, prefix = get_series(number)

        print(f"[{number:02d}] {name} ({series_name})")

        # Copy raw to web/cards/ as PNG
        raw_img = Image.open(f)
        safe_name = name.lower().replace(' ', '-').replace("'", "")
        raw_web_path = WEB_RAW_DIR / f"GPK-{number:02d}_{safe_name}.png"
        raw_img.save(str(raw_web_path), "PNG")

        # Frame it
        out = frame_card(f, number, name, series_name, prefix)
        print(f"  → {out.name}")

    print(f"\n{'='*50}")
    print(f"Framed {len(files)} cards!")
    print(f"  cards/framed/  : {len(list(FRAMED_DIR.glob('GPK-*_framed.png')))} framed PNGs")
    print(f"  web/cards/framed/ : {len(list(WEB_FRAMED_DIR.glob('GPK-*_framed.png')))} framed PNGs")
    print(f"  web/cards/     : {len(list(WEB_RAW_DIR.glob('GPK-*.png')))} raw PNGs")


if __name__ == "__main__":
    main()
