
import { ReferenceType, SetReferenceType } from './types';

export const AESTHETIC_PROMPT_CORE = `
Primary aesthetic: Urban spiritual realism. 
Visual Style: Indigo, cyan, ultramarine shadows with warm amber and fuchsia accents.
Lighting: Deep, painterly precision, subconscious mood, subtle specular reflections on surfaces, soft organic scattering.
Cinematography: 35mm prime equivalent, shallow depth of field with bokeh, slight film grain, high fidelity textures.
Mood: Serenity mixed with anticipation, cinematic lighting (5200K).
`;

export const CHARACTER_TEMPLATES: Record<ReferenceType, string> = {
  HEADSHOT: "Extreme close-up cinematic headshot, neutral expression, microscopic skin texture and iris detail, neutral studio background, soft key lighting, character focus.",
  BODY_REVERSE: "Full body anatomical character reference sheet showing 3 distinct poses side-by-side: Front view, 3/4 profile view, and strict Profile view. The character is wearing character-appropriate minimal athletic briefs to clearly define musculature, skeletal structure, and defining physical traits. Clinical but cinematic lighting, clean simple studio background, high-detail skin rendering.",
  WARDROBE: "Full body reference in iconic character wardrobe, urban spiritual style clothing, visible fabric textures (cotton, canvas), standing in a softly lit nocturnal street under overpass.",
  ACTION: "Action pose reference, character in mid-motion, cinematic dynamic energy, fluid handheld camera perspective, interacting with urban environment.",
  EXPRESSION: "Facial expression sheet showing range of 3 emotions: calm, determination, and subtle smile. Close-up portraits.",
  NEUTRAL_SHEET: "Professional character design sheet, neutral flat studio lighting, solid light grey background, no shadows, full body front view, high-fidelity details, clearly visible features and colors without cinematic bloom."
};

export const SET_TEMPLATES: Record<SetReferenceType, string> = {
  WIDE: "Establishing wide-angle landscape shot of the environment, capturing the full scale and architecture, deep depth of field, atmospheric perspective.",
  MEDIUM: "Medium shot focusing on the primary acting area or central hub of the set, showing functional elements and spatial relationships.",
  POV: "Immersive point-of-view shot from the perspective of someone standing in the space, eye-level, capturing the immediate surroundings and tactile atmosphere.",
  DETAIL: "Macro detail shot focusing on specific textures, props, or unique environmental elements (e.g., moss on concrete, glowing circuitry, rain on glass).",
  PLAN: "Top-down architectural plan view of the set, schematic-like but visually rich, showing layout and furniture/environmental placement.",
  LIGHTING: "Abstract lighting and ambiance study focusing purely on how light interacts with the space, emphasizing shadows, glows, and the color palette."
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
  aesthetic: 'Urban Spiritual Realism'
};

export const INITIAL_SET_PROFILE = {
  id: '',
  seed: 0,
  name: '',
  locationType: 'Indoor' as const,
  lighting: '',
  ambiance: '',
  style: '',
  details: ''
};
