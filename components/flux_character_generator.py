import random

def generate_flux_dick_description(
    seed: int = None,
    body_type: str = "average",
    skin_tone: str = "medium",
    arousal: str = "erect"
) -> str:
    """
    Flux-optimized dick description generator.
    """
    if seed is not None:
        random.seed(seed)

    # Size
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

    # Body harmony adjustment
    if body_type in ["muscular", "bear", "athletic"]:
        size_desc = size_desc.replace("6 inch", "7 inch").replace("6.5 inch", "7.5 inch")

    # Foreskin
    foreskin = random.choices([
        "beautiful uncut cock with long silky foreskin that partially covers the head",
        "uncut with a generous overhang and smooth retracting foreskin",
        "uncut with tight sensitive foreskin that peels back to reveal a plump glans",
        "partially hooded uncut cock with natural drape",
        "smoothly circumcised with a perfectly flared prominent head"
    ], weights=[35, 30, 18, 10, 7])[0]

    # Glans
    glans = random.choice([
        "plump mushroom glans with thick flared coronal ridge",
        "wide helmet-shaped head with deep defined rim",
        "elegant acorn glans that catches the light beautifully",
        "thick rounded crown with subtle ridge",
        "pronounced flared head with smooth glossy surface"
    ])

    # Curvature
    curve = random.choices([
        "perfectly straight and proud",
        "gentle pleasurable upward curve",
        "subtle natural downward arc",
        "slight sexy leftward bend"
    ], weights=[60, 25, 10, 5])[0]

    # Veins
    veins = random.choice([
        "prominent raised veins running along the shaft",
        "thick dorsal vein with delicate branching veins",
        "realistic vascular texture with visible pulsing veins",
        "lightly veined with natural skin texture",
        "heavily veined and powerfully masculine"
    ])

    # Taper
    taper = random.choice([
        "thicker at the base tapering elegantly to the head",
        "uniform thick girth with powerful presence",
        "heavier base narrowing gracefully toward the tip"
    ])

    # Color
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

    # Arousal
    arousal_map = {
        "flaccid": "soft but thick and heavy, resting naturally",
        "semi": "semi-erect, thickening beautifully with visible veins",
        "erect": "fully erect, rock-hard and throbbing",
        "throbbing": "throbbing hard with prominent veins and a glistening bead of precum at the tip",
        "leaking": "rock-hard and leaking clear precum from the slit"
    }
    arousal_desc = arousal_map.get(arousal, "fully erect, rock-hard and throbbing")

    # Final dick string
    return (
        f"{size_desc} {foreskin}, {glans}, {curve}, "
        f"{veins}, {taper}, {color_desc}, "
        f"paired with {balls}, framed by {pubes}, "
        f"{arousal_desc}, highly detailed realistic anatomy, "
        f"natural skin texture, subtle sweat and sheen, photorealistic"
    )


def generate_flux_full_body_male(
    seed: int = None,
    age_range: tuple = (22, 35),
    ethnicity: str = "latino",
    body_type: str = "average",
    height: str = "average",
    arousal: str = "erect"
) -> str:
    """
    Complete Flux-ready full-body male character prompt with randomized beautiful dick.
    """
    if seed is not None:
        random.seed(seed)

    # Basic appearance
    ages = list(range(age_range[0], age_range[1] + 1))
    age = random.choice(ages)

    face = random.choice([
        "handsome sharp facial features, high cheekbones, strong jawline",
        "ruggedly attractive face with stubble and intense eyes",
        "boyish good looks with soft features and full lips",
        "mature handsome face with trimmed beard and piercing gaze",
        "classically attractive with symmetrical features and warm smile"
    ])

    hair_options = {
        "latino": ["short black hair, neatly styled", "messy dark wavy hair", "fade haircut with slight waves", "short curly black hair"],
        "caucasian": ["short brown hair", "messy dirty-blond hair", "neat chestnut hair", "undercut with longer top"],
        "black": ["short cropped black hair", "tight curls", "fade with waves", "braided short style"],
        "asian": ["straight black hair with modern cut", "slightly longer stylish black hair"],
        "middle-eastern": ["thick dark hair with slight waves", "neat short beard and hair"],
        "mixed": ["wavy dark hair", "curly brown hair with fade"]
    }
    hair = random.choice(hair_options.get(ethnicity.lower(), ["short dark hair"]))

    eyes = random.choice([
        "deep brown eyes full of intensity",
        "warm hazel eyes with long lashes",
        "piercing dark eyes",
        "expressive brown eyes",
        "striking green-hazel eyes"
    ])

    skin_map = {
        "latino": "smooth tanned olive skin",
        "caucasian": "fair to light tan skin with subtle freckles",
        "black": "rich deep ebony skin with natural sheen",
        "asian": "smooth warm beige skin",
        "middle-eastern": "warm olive skin with golden undertone",
        "mixed": "golden tan skin with warm undertones"
    }
    skin = skin_map.get(ethnicity.lower(), "smooth tanned skin")

    body_desc = {
        "slim": "slim athletic build, lean muscles, narrow waist",
        "average": "fit average build, toned but natural",
        "athletic": "athletic toned body, defined muscles, V-shaped torso",
        "muscular": "muscular athletic physique, broad shoulders, ripped abs, powerful arms and legs",
        "bear": "stocky powerful bear build, thick chest, soft belly, strong arms and thighs"
    }.get(body_type.lower(), "fit average build")

    height_desc = {
        "short": "5'6\" compact and powerful frame",
        "average": "5'10\" well-proportioned frame",
        "tall": "6'2\" tall commanding presence"
    }.get(height.lower(), "5'10\" well-proportioned frame")

    # Generate dick using the same seed for consistency
    dick = generate_flux_dick_description(
        seed=seed,
        body_type=body_type,
        skin_tone=ethnicity.lower() if ethnicity.lower() in ["light", "medium", "olive", "tan", "dark", "deep"] else "medium",
        arousal=arousal
    )

    # Pose
    pose = random.choice([
        "standing confidently full frontal nude pose, arms relaxed at sides",
        "standing with slight contrapposto, weight on one leg, looking at viewer",
        "relaxed standing pose with hands on hips, chest slightly forward",
        "casual full body standing in bedroom, natural lighting"
    ])

    # Final full-body prompt
    full_description = (
        f"handsome {age}-year-old {ethnicity} man, {height_desc}, {body_desc}, "
        f"{skin}, {hair}, {face}, {eyes}, "
        f"completely naked, {pose}, "
        f"{dick}, "
        f"highly detailed realistic anatomy, natural skin texture and pores, "
        f"subtle sweat sheen, soft studio lighting, cinematic composition, "
        f"masterpiece, best quality, ultra realistic, 8k, photorealistic"
    )

    return full_description


# ==================== EXAMPLE USAGE ====================

if __name__ == "__main__":
    print("=== Flux Full-Body Male Character Generator ===\n")
    
    for i in range(5):
        prompt = generate_flux_full_body_male(
            seed=420 + i,                    # Change seed for new characters
            ethnicity="latino",
            body_type="muscular",
            height="tall",
            arousal="throbbing"
        )
        print(f"--- Character {i+1} (Seed: {420 + i}) ---\n")
        print(prompt)
        print("\n" + "="*80 + "\n")
