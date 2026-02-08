#!/usr/bin/env python3
"""Regenerate 3 Music series cards via ComfyUI (no banners/nameplates)."""
import json, time, urllib.request, uuid, shutil, os
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUTPUT_DIR = Path(r"C:\Users\PC\Desktop\projects\garbagepalkids\cards\gpk")

CARDS = [
    {
        "filename": "36_devo_danny",
        "prompt": (
            "Garbage Pail Kids trading card painting in the style of John Pound, "
            "Topps 1985, acrylic gouache, caricature portrait, adult character NOT a baby, "
            "3:4 portrait ratio, NO TEXT, NO WORDS, NO LETTERS, NO BANNER, NO NAMEPLATE, NO TITLE, NO LOGO — "
            "Caricature portrait of Mark Mothersbaugh as a Garbage Pail Kid, his round nerdy face "
            "with thick-framed rectangular glasses sitting crooked, thinning reddish hair visible "
            "under the iconic red flower pot energy dome hat that has cracked open revealing his "
            "brain is literally devolving — half smooth pink brain matter, half primitive lizard "
            "brain with scales, one eye normal behind glasses and the other reptilian with a slit "
            "pupil, body half-human in a yellow hazmat jumpsuit and half-devolved into a hunched "
            "scaly primate with a tail, mechanical whip in one hand cracking and sparking, the "
            "other hand becoming a flipper, assembly line of identical flower-pot-hat clones behind "
            "him all in progressive stages of de-evolution from human to fish, robotic jerky "
            "movements implied by motion lines, expression of vacant corporate compliance"
        ),
        "seed": 883201,
    },
    {
        "filename": "38_ween_dean",
        "prompt": (
            "Garbage Pail Kids trading card painting in the style of John Pound, "
            "Topps 1985, acrylic gouache, caricature portrait, adult character NOT a baby, "
            "3:4 portrait ratio, NO TEXT, NO WORDS, NO LETTERS, NO BANNER, NO NAMEPLATE, NO TITLE, NO LOGO — "
            "Caricature portrait of Dean Ween and Gene Ween as a two-headed Garbage Pail Kid, "
            "Dean's head with his dark curly hair and scruffy goatee stoner grin with permanently "
            "glazed half-lidded eyes, Gene's head with messy brown hair and rounder softer face "
            "screaming country music, wearing a ridiculous outfit that's half country-western "
            "rhinestone cowboy and half crusty punk, riding a giant melting Boognish demon idol "
            "that's oozing brown sludge everywhere, tentacles sprouting from the Boognish made of "
            "guitar strings, one hand holding a bottle of brown liquid that's transforming everything "
            "it splashes into something weird, a trail of mutated brown creatures following behind "
            "them, Dean's head wearing a beanie and Gene's head wearing a cowboy hat, the Boognish's "
            "tongue a long cassette tape unspooling, background shifting between a Nashville "
            "honky-tonk and a filthy basement venue"
        ),
        "seed": 772401,
    },
    {
        "filename": "40_primus_pete",
        "prompt": (
            "Garbage Pail Kids trading card painting in the style of John Pound, "
            "Topps 1985, acrylic gouache, caricature portrait, adult character NOT a baby, "
            "3:4 portrait ratio, NO TEXT, NO WORDS, NO LETTERS, NO BANNER, NO NAMEPLATE, NO TITLE, NO LOGO — "
            "Caricature portrait of Les Claypool as a Garbage Pail Kid, his long thin face with "
            "bulging goggle eyes, prominent pointy nose, scraggly brown goatee stretching down to "
            "his chest, wearing his signature floppy fishing hat and overalls on a lanky wiry frame, "
            "sitting in a tiny rowboat in a swamp of thick brown mud, playing an enormous upright "
            "bass that's actually a giant living catfish — the fish-bass thrashing and flailing while "
            "he slaps its belly producing visible funky bass waves that are warping reality around "
            "him, the swamp water rippling in concentric grooves like a vinyl record, crawdads and "
            "bullfrogs being launched into the air by the bass vibrations, his fingers moving so "
            "fast they've multiplied into dozens of blurry finger-copies, the boat sinking under the "
            "weight of the massive fish-instrument, bubbles rising from the mud containing tiny "
            "dancing goblins"
        ),
        "seed": 559301,
    },
]

WORKFLOW_TEMPLATE = {
    "3": {
        "class_type": "KSampler",
        "inputs": {
            "cfg": 1.0,
            "denoise": 1.0,
            "latent_image": ["5", 0],
            "model": ["4", 0],
            "negative": ["7", 0],
            "positive": ["6", 0],
            "sampler_name": "euler",
            "scheduler": "simple",
            "seed": 0,
            "steps": 4,
        },
    },
    "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {"ckpt_name": "flux1-schnell-fp8.safetensors"},
    },
    "5": {
        "class_type": "EmptyLatentImage",
        "inputs": {"batch_size": 1, "height": 1024, "width": 1024},
    },
    "6": {
        "class_type": "CLIPTextEncode",
        "inputs": {"clip": ["4", 1], "text": ""},
    },
    "7": {
        "class_type": "CLIPTextEncode",
        "inputs": {"clip": ["4", 1], "text": ""},
    },
    "8": {
        "class_type": "VAEDecode",
        "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
    },
    "9": {
        "class_type": "SaveImage",
        "inputs": {"filename_prefix": "gpk_regen", "images": ["8", 0]},
    },
}


def queue_prompt(workflow, client_id):
    data = json.dumps({"prompt": workflow, "client_id": client_id}).encode()
    req = urllib.request.Request(
        f"{COMFY}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())


def wait_for_completion(prompt_id, timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = urllib.request.urlopen(f"{COMFY}/history/{prompt_id}")
            history = json.loads(resp.read())
            if prompt_id in history:
                return history[prompt_id]
        except Exception:
            pass
        time.sleep(2)
    raise TimeoutError(f"Generation timed out after {timeout}s")


def find_output_image(history):
    """Extract output filename from ComfyUI history."""
    outputs = history.get("outputs", {})
    for node_id, node_out in outputs.items():
        images = node_out.get("images", [])
        for img in images:
            return img["filename"], img.get("subfolder", "")
    return None, None


def main():
    client_id = str(uuid.uuid4())
    comfy_output = Path(r"C:\Users\PC\Desktop\ComfyUI\output")

    for card in CARDS:
        print(f"\n{'='*60}")
        print(f"Generating: {card['filename']}")
        print(f"{'='*60}")

        # Build workflow
        wf = json.loads(json.dumps(WORKFLOW_TEMPLATE))
        wf["6"]["inputs"]["text"] = card["prompt"]
        wf["3"]["inputs"]["seed"] = card["seed"]
        wf["9"]["inputs"]["filename_prefix"] = card["filename"]

        # Queue
        result = queue_prompt(wf, client_id)
        prompt_id = result["prompt_id"]
        print(f"  Queued: {prompt_id}")

        # Wait
        t0 = time.time()
        history = wait_for_completion(prompt_id)
        elapsed = time.time() - t0
        print(f"  Done in {elapsed:.1f}s")

        # Find output
        filename, subfolder = find_output_image(history)
        if not filename:
            print(f"  ERROR: No output image found!")
            continue

        src = comfy_output / subfolder / filename if subfolder else comfy_output / filename
        dst = OUTPUT_DIR / f"{card['filename']}.png"

        # Copy to cards directory
        shutil.copy2(src, dst)
        print(f"  Saved: {dst}")
        print(f"  Size: {dst.stat().st_size / 1024:.0f} KB")

    print(f"\n{'='*60}")
    print("All 3 cards regenerated!")


if __name__ == "__main__":
    main()
