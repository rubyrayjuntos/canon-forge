import { ReferenceType, SetReferenceType } from './types';
import { HEADSHOT_SCENE } from './utils/identityLock.js';

// Set to true for faster testing with simpler prompts
const TEST_MODE = false;

export const AESTHETIC_PROMPT_CORE = TEST_MODE
  ? `Cinematic portrait, indigo and amber lighting, film grain.`
  : `
Primary aesthetic: Urban spiritual realism. 
Visual Style: Indigo, cyan, ultramarine shadows with warm amber and fuchsia accents.
Lighting: Deep, painterly precision, subconscious mood, subtle specular reflections on surfaces, soft organic scattering.
Cinematography: 35mm prime equivalent, shallow depth of field with bokeh, slight film grain, high fidelity textures.
Mood: Serenity mixed with anticipation, cinematic lighting (5200K).
`;

export const AESTHETIC_PROMPT_CORE_FAST = `
Primary aesthetic: Urban spiritual realism. 
Lighting: Clean studio lighting with minimal shadow complexity.
Cinematography: 35mm prime equivalent, balanced exposure, light film grain.
`;

export const CHARACTER_TEMPLATES: Record<ReferenceType, string> = TEST_MODE
  ? {
      HEADSHOT: 'Close-up headshot, neutral background.',
      BODY_REVERSE: 'Full body front view, simple background.',
      BODY_NUDE: 'Full body figure reference, front and 3/4 view, standing naturally, studio lighting.',
      BODY_NUDE_FRONT: 'Full body figure reference, front view only, standing naturally, neutral studio lighting.',
      BODY_NUDE_THREE_QUARTER: 'Full body figure reference, three-quarter view only, standing naturally, neutral studio lighting.',
      BODY_NUDE_PROFILE: 'Full body figure reference, strict profile side view only, standing naturally, neutral studio lighting.',
      BODY_NUDE_BACK: 'Full body figure reference, back view only, standing naturally, neutral studio lighting.',
      WARDROBE: 'Full body with clothing, urban setting.',
      ACTION: 'Action pose, dynamic.',
      EXPRESSION: 'Face showing emotion.',
      NEUTRAL_SHEET: 'Character reference sheet, neutral lighting.',
    }
  : {
      HEADSHOT:
        HEADSHOT_SCENE,
      BODY_NUDE:
        'Full body figure reference. Front view and 3/4 profile view side-by-side. The character is standing naturally, unclothed, in a neutral studio. Accurate human proportions, musculature, and skin detail. Studio lighting: soft key light, fill shadow, specular highlights on skin. Clean background. Character design reference sheet.',
      BODY_NUDE_FRONT:
        'Character figure reference sheet. Full body front view only, standing naturally, unclothed, neutral studio lighting. Accurate human proportions, musculature, and skin detail. Neutral studio background. Single subject, single camera view.',
      BODY_NUDE_THREE_QUARTER:
        'Character figure reference sheet. Full body three-quarter angle only (about 45 degrees), standing naturally, unclothed. Preserve torso twist and hip alignment. Neutral studio background. Single subject, single camera view.',
      BODY_NUDE_PROFILE:
        'Character figure reference sheet. Full body strict side profile only, standing naturally, unclothed. Emphasize side silhouette accuracy: cranial angle, neck line, chest depth, abdominal contour, glute projection, knee alignment, and ankle/foot profile. Single subject, single camera view.',
      BODY_NUDE_BACK:
        'Character figure reference sheet. Full body back view only, standing naturally, unclothed. Emphasize posterior anatomy: trapezius, lat spread, spinal line, glute contour, hamstrings, calf structure, and heel/foot alignment. Single subject, single camera view.',
      BODY_REVERSE:
        'Full body character anatomy reference sheet. Front, three-quarter, profile, and back views as a clean turnaround. Character stands naturally in selected body-study wardrobe. Neutral studio background, even lighting, accurate proportions, head-to-toe framing, arms relaxed.',
      WARDROBE:
        'Full body reference in iconic character wardrobe, urban spiritual style clothing, visible fabric textures (cotton, canvas), standing in a softly lit nocturnal street under overpass. Natural human proportions: do not compress, squash, or stretch the figure. Head-to-toe in a 3:4 frame.',
      ACTION:
        'Action pose reference, character in mid-motion, cinematic dynamic energy, fluid handheld camera perspective, interacting with urban environment.',
      EXPRESSION:
        'Facial expression sheet showing range of 3 emotions: calm, determination, and subtle smile. Close-up portraits.',
      NEUTRAL_SHEET:
        'Professional character design sheet, neutral flat studio lighting, solid light grey background, no shadows, full body front view, high-fidelity details, clearly visible features and colors without cinematic bloom.',
    };

export const SET_TEMPLATES: Record<SetReferenceType, string> = {
  WIDE: 'Establishing wide-angle landscape shot of the environment, capturing the full scale and architecture, deep depth of field, atmospheric perspective.',
  MEDIUM:
    'Medium shot focusing on the primary acting area or central hub of the set, showing functional elements and spatial relationships.',
  POV: 'Immersive point-of-view shot from the perspective of someone standing in the space, eye-level, capturing the immediate surroundings and tactile atmosphere.',
  DETAIL:
    'Macro detail shot focusing on specific textures, props, or unique environmental elements (e.g., moss on concrete, glowing circuitry, rain on glass).',
  PLAN: 'Top-down architectural plan view of the set, schematic-like but visually rich, showing layout and furniture/environmental placement.',
  LIGHTING:
    'Abstract lighting and ambiance study focusing purely on how light interacts with the space, emphasizing shadows, glows, and the color palette.',
};

export const INITIAL_CHARACTER_PROFILE = {
  id: '',
  seed: 0,
  name: '',
  age: '',
  gender: 'Non-binary',
  eyes: '',
  hair: '',
  build: '',
  skinTone: '',
  distinctiveFeatures: '',
  personality: '',
  backstory: '',
  aesthetic: 'Urban Spiritual Realism',
  undergarmentType: 'Minimal briefs',
  undergarmentFit: 'Standard',
  undergarmentStyle: 'Matte black',
  wardrobe: '',
};

export const INITIAL_SET_PROFILE = {
  id: '',
  seed: 0,
  name: '',
  locationType: 'Indoor' as const,
  lighting: '',
  ambiance: '',
  style: '',
  details: '',
  spatialInvariants:
    'Primary room proportions and circulation remain fixed across all renders.',
  fixedLandmarks:
    'Landmarks locked: main entry, primary focal structure, key window or opening, central floor anchor.',
  forbiddenChanges:
    'Do not relocate major structures, invert layout, or replace core architectural features.',
  lightingRigLock:
    'Key light from camera-left at 45 degrees, soft fill at low ratio, subtle rim separation, controlled haze.',
};
