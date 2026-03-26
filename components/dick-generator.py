import random

def generate_flux_dick_description(
    seed: int = None,
    body_type: str = "average",      # "slim", "average", "muscular", "bear", "athletic"
    skin_tone: str = "medium",       # "light", "medium", "olive", "tan", "dark", "deep"
    arousal: str = "erect"           # "flaccid", "semi", "erect", "throbbing", "leaking"
) -> str:
    """
    Returns a Flux-optimized, detailed dick description.
    Designed to produce beautiful, varied, realistic results in Flux.
    """
    if seed is not None:
        random.seed(seed)  # Same character = same dick every time

    # Size (Flux loves natural but impressive sizes)
    sizes = [
        ("thick 6 inch", 15),
        ("veiny 6.5 inch", 20),
        ("handsome 7 inch", 25),
        ("impressive thick 7.5 inch", 18),
        ("substantial 8 inch", 12),
        ("girthy 8.5 inch", 7),
        ("majestic heavy 9 inch", 3)
    ]
    size_desc = random.choices([s[0] for s in sizes], [s[1] for s in sizes])[0]

    # Body harmony
    if body_type in ["muscular", "bear", "athletic"]:
        size_desc = size_desc.replace("6 inch", "7 inch").replace("6.5 inch", "7.5 inch")

    # Foreskin (Flux renders uncut extremely well)
    foreskin = random.choices([
        "beautiful uncut cock with long silky foreskin that partially covers the head",
        "uncut with a generous overhang and smooth retracting foreskin",
        "uncut with tight sensitive foreskin that peels back to reveal a plump glans",
        "partially hooded uncut cock with natural drape",
        "smoothly circumcised with a perfectly flared prominent head"
    ], weights=[35, 30, 18, 10, 7])[0]

    # Glans & Head
    glans = random.choice([
        "plump mushroom glans with thick flared coronal ridge",
        "wide helmet-shaped head with deep defined rim",
        "elegant acorn glans that catches the light beautifully",
        "thick rounded crown with subtle ridge",
        "pronounced flared head with smooth glossy surface"
    ])

    # Curvature (subtle = more realistic in Flux)
    curve = random.choices([
        "perfectly straight and proud",
        "gentle pleasurable upward curve",
        "subtle natural downward arc",
        "slight sexy leftward bend"
    ], weights=[60, 25, 10, 5])[0]

    # Veins & Texture
    veins = random.choice([
        "prominent raised veins running along the shaft",
        "thick dorsal vein with delicate branching veins",
        "realistic vascular texture with visible pulsing veins",
        "lightly veined with natural skin texture",
        "heavily veined and powerfully masculine"
    ])

    # Taper & Shape
    taper = random.choice([
        "thicker at the base tapering elegantly to the head",
        "uniform thick girth with powerful presence",
        "heavier base narrowing gracefully toward the tip"
    ])

    # Color harmony (Flux is very good with skin tone matching)
    color_map = {
        "light": "pale pink shaft with a flushed rosy head",
        "medium": "warm tan shaft with a deeper flushed glans",
        "olive": "rich olive-toned skin with rosy-purple head",
        "tan": "golden tan shaft contrasting with a darker sensitive head",
        "dark": "deep brown velvet shaft with a highly sensitive darker head",
        "deep": "rich deep brown skin with glossy purple-brown glans"
    }
    color_desc = color_map.get(skin_tone, "warm tan shaft with darker flushed head")

    # Scrotum
    balls = random.choice([
        "full low-hanging balls in a smooth relaxed sac",
        "plump heavy balls with natural asymmetry",
        "generous pendulous balls nestled in soft skin",
        "tight high-riding balls drawn up with arousal"
    ])

    # Pubic hair
    pubes = random.choice([
        "neatly trimmed dark pubic hair framing the thick base",
        "sexy happy trail leading to a natural well-groomed bush",
        "smoothly shaved with subtle stubble shadow",
        "light natural grooming accentuating the cock"
    ])

    # Arousal state (Flux loves shine and wetness)
    arousal_map = {
        "flaccid": "soft but thick and heavy, resting naturally",
        "semi": "semi-erect, thickening beautifully with visible veins",
        "erect": "fully erect, rock-hard and throbbing",
        "throbbing": "throbbing hard with prominent veins and a glistening bead of precum at the tip",
        "leaking": "rock-hard and leaking clear precum from the slit"
    }
    arousal_desc = arousal_map.get(arousal, "fully erect, rock-hard and throbbing")

    # Final Flux-optimized string
    description = (
        f"{size_desc} {foreskin}, {glans}, {curve}, "
        f"{veins}, {taper}, {color_desc}, "
        f"paired with {balls}, framed by {pubes}, "
        f"{arousal_desc}, highly detailed realistic anatomy, "
        f"natural skin texture, subtle sweat and sheen, photorealistic"
    )

    return description


# ==================== EXAMPLE USAGE FOR FLUX ====================

# Example 1: Fixed character (always the same dick)
dick_prompt = generate_flux_dick_description(
    seed=12345,
    body_type="muscular",
    skin_tone="olive",
    arousal="throbbing"
)

full_prompt = (
    "full body portrait of a handsome 25 year old latino man, muscular build, "
    "tanned skin, short black hair, standing naked in bedroom, "
    + dick_prompt +
    ", masterpiece, best quality, ultra detailed, realistic lighting, 8k"
)

print(full_prompt)
