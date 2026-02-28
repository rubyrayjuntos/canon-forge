export const MAX_INT32 = 2147483647;

/** Returns a random element from an array. */
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Generates a cryptographically unique ID. */
export const generateId = (): string => crypto.randomUUID();

/** Generates a random seed bounded to 32-bit signed integer range. */
export const generateSeed = (): number => Math.floor(Math.random() * MAX_INT32);

const CHARACTER_NAMES = ['Silas Thorne', 'Kora Vance', 'Malachi Quinn', 'Lyra Skye', 'Dante Rios'];
const CHARACTER_AGES = ['21', '28', '35', '42', '56'];
const CHARACTER_BUILDS = ['Lithe & Graceful', 'Broad & Athletic', 'Wiry & Powerful', 'Compact & Agile'];
const CHARACTER_EYES = ['Glowing Indigo', 'Cybernetic Emerald', 'Deep Obsidian', 'Mismatched Amber'];
const CHARACTER_HAIR = ['Braided coils', 'Silver-white fade', 'Neon blue undercut', 'Long flowing black'];
const CHARACTER_SKIN_TONES = ['Pale ivory', 'Deep mahogany', 'Warm olive', 'Rich bronze'];
const CHARACTER_FEATURES = [
  'Faint neck tattoo', 'Mechanical right eye', 'Surgical scar on temple', 'Clockwork left hand',
];

/**
 * Returns a randomized subset of character profile fields.
 * Does not include id, seed, gender, backstory, or aesthetic — those are preserved.
 */
export const randomCharacterData = () => ({
  name: pick(CHARACTER_NAMES),
  age: pick(CHARACTER_AGES),
  build: pick(CHARACTER_BUILDS),
  eyes: pick(CHARACTER_EYES),
  hair: pick(CHARACTER_HAIR),
  skinTone: pick(CHARACTER_SKIN_TONES),
  distinctiveFeatures: pick(CHARACTER_FEATURES),
  personality: 'Stoic wanderer with a sense of purpose.',
});

const SET_NAMES: Record<'Indoor' | 'Outdoor', string[]> = {
  Indoor: ['Neon Cyber-Cafe', 'Subterranean Shrine', 'Luxury Sky-Loft', 'Derelict Laboratory', 'Alien Spaceship Bridge', 'High-Tech Monastery'],
  Outdoor: ['Floating Rain-District', 'Abandoned Sprawl-Park', 'Ritual Rooftop', 'Monolithic Overpass', 'Magma-Side Industrial Outpost'],
};
const SET_LIGHTING = [
  'Cold cyan fluorescents with warm back-glow',
  'Natural filtered moonlight through smog',
  'Dashing strobe pulses of amber',
  'Eternal dusk soft indigo wash',
  'Bioluminescent pulsing organic light',
];
const SET_AMBIANCE = [
  'Thrumming industrial silence',
  'Hushed spiritual reverence',
  'Chaotic urban bustle',
  'Melancholic solitude',
  'Tense high-tech hum',
];

/**
 * Returns randomized set profile fields appropriate for the given location type.
 */
export const randomSetData = (locationType: 'Indoor' | 'Outdoor') => ({
  name: pick(SET_NAMES[locationType]),
  lighting: pick(SET_LIGHTING),
  ambiance: pick(SET_AMBIANCE),
  style: 'Urban Spiritual Realism',
  details: 'Rain-slicked surfaces, floating holographic talismans, intricate brutalist architecture.',
});

const COMP_ACTIONS = [
  "Actively piloting the ship while sitting in the captain's seat",
  'Meditating on a ritual rooftop as rain falls upwards',
  'Engaged in a tense negotiation with a shadowy figure',
  'Repairing a complex mechanical prosthetic in the glow of a neon sign',
  'Standing stoically while wind whips their cloak against a monolithic sky',
];
const COMP_ACTORS = [
  'A hovering security drone',
  'Two hooded acolytes in the background',
  'A translucent holographic guide',
  'None',
];

/** Returns randomized composite action and extra actors. */
export const randomCompositeData = () => ({
  action: pick(COMP_ACTIONS),
  extraActors: pick(COMP_ACTORS),
});
