function filled(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s ? s : fallback;
}

export function faceReferenceInstruction(hasFaceReference) {
  if (!hasFaceReference) return '';
  return [
    'FACE REFERENCE IMAGE IS ATTACHED. This is the canon identity.',
    'Reproduce this exact person. Do not beautify, age-shift, gender-shift, or invent a sibling.',
    'Match skull shape, eye spacing, nose, mouth, hairline, facial hair, skin tone, and distinctive markers.',
  ].join(' ');
}

export function buildCharacterIdentityBlock(profile, options = {}) {
  const name = filled(profile?.name, 'Unnamed Subject');
  const age = filled(profile?.age, '32');
  const gender = filled(profile?.gender, 'adult');
  const build = filled(profile?.build, 'athletic with natural proportions');
  const skinTone = filled(profile?.skinTone, 'medium skin tone with natural texture');
  const eyes = filled(profile?.eyes, 'dark brown');
  const hair = filled(profile?.hair, 'short textured hair');
  const distinct = filled(
    profile?.distinctiveFeatures,
    'defined jawline, subtle asymmetry around brows, realistic skin pores'
  );
  const wardrobe = filled(
    profile?.wardrobe,
    'weathered dark jacket, charcoal tee, utilitarian trousers, worn boots'
  );
  const personality = filled(
    profile?.personality,
    'Calm, observant, emotionally contained under pressure.'
  );
  const backstory = filled(
    profile?.backstory,
    'Carries lived urban history; disciplined and self-possessed.'
  );
  const aesthetic = filled(profile?.aesthetic, 'Urban spiritual realism');
  const faceLine = faceReferenceInstruction(Boolean(options.hasFaceReference));
  const isHeadshot = options.shotType === 'HEADSHOT';

  if (isHeadshot) {
    return [
      `Identity Lock (MANDATORY FACE): ${name}, ${age}y/o ${gender}.`,
      `Face fill: ${skinTone}, ${eyes} eyes, ${hair}. Distinctive facial markers to reproduce exactly: ${distinct}.`,
      `Expression: neutral, eyes into lens, no smile. Personality only as gaze: ${personality}`,
      `In-frame wardrobe only: collar, neckline, or shoulders of ${wardrobe}. Do not show waist, legs, feet, or a standing figure.`,
      'Consistency priorities (do not drift): skull shape, eye spacing, iris color, nose, mouth, hairline/bald pattern, facial hair, scarring, tattoos, eyewear, and skin texture.',
      faceLine,
    ].filter(Boolean).join('\n');
  }

  return [
    `Identity Lock (MANDATORY): ${name}, ${age}y/o ${gender}, ${build}, ${skinTone}, ${eyes} eyes, ${hair}. Distinctive markers: ${distinct}.`,
    `Narrative Cues: ${personality} Backstory signal: ${backstory}.`,
    `Styling DNA: ${aesthetic}. Signature wardrobe: ${wardrobe}.`,
    'Consistency priorities (do not drift): preserve facial-hair geometry, eyewear shape if present, hairline and temple shape, shoulder-to-waist ratio, chest/body hair pattern, and bone landmarks (clavicle/jawline).',
    faceLine,
  ].filter(Boolean).join('\n');
}

export const HEADSHOT_SCENE = [
  'SHOT TYPE: tight cinematic head-and-shoulders portrait, not a full-body image.',
  'Framing: 85mm portrait lens, camera at eye height, face centered, eyes on the upper third.',
  'Crop: top of head to upper chest / clavicle only. Face occupies most of the frame.',
  'Background: plain dark studio, out-of-focus, no environment, no floor, no feet.',
  'Detail: microscopic skin texture, pores, iris detail, and every distinctive facial marker sharp.',
  'Single subject, single camera, one face. No wide shot, no standing pose, no fashion lookbook.',
].join(' ');

export const HEADSHOT_NEGATIVE_CONSTRAINTS = [
  'full body',
  'full-length',
  'head to toe',
  'standing figure',
  'wide shot',
  'establishing shot',
  'feet',
  'shoes',
  'boots',
  'legs',
  'knees',
  'torso below chest',
  'triptych',
  'diptych',
  'contact sheet',
  'split screen',
  'collage',
  'duplicate person',
  'multiple panels',
].join(', ');

export function isFaceEstablishingShot(type) {
  return type === 'HEADSHOT';
}

export function isFigureStudyShot(type) {
  return String(type).startsWith('BODY_NUDE');
}

export function requiresCanonFace(type) {
  return type !== 'HEADSHOT';
}

export function isSetEstablishingShot(type) {
  return type === 'WIDE';
}

export function setLockReferenceUrl(profile, type) {
  if (!profile) return undefined;
  if (type === 'WIDE') return profile.canonWideUrl || undefined;
  return profile.canonWideUrl || profile.canonMediumUrl || undefined;
}

export function shouldUseInitImage({ provider, forgeType, type }) {
  if (provider === 'venice' || provider === 'aws') return false;
  if (provider === 'xai' || provider === 'local-llm' || provider === 'local-sd') {
    if (forgeType === 'SetForge') return true;
    if (forgeType === 'CompositorForge') return false;
    return type === 'HEADSHOT' || type === 'EXPRESSION';
  }
  return true;
}

export function pickAutoLockPatch(forgeType, type, url) {
  if (!url) return null;
  if (forgeType === 'CharacterForge' && type === 'HEADSHOT') {
    return { canonHeadshotUrl: url };
  }
  if (forgeType === 'SetForge' && type === 'WIDE') {
    return { canonWideUrl: url };
  }
  if (forgeType === 'SetForge' && type === 'MEDIUM') {
    return { canonMediumUrl: url };
  }
  return null;
}

export function shotAspectRatio(type) {
  if (type === 'HEADSHOT') return '1:1';
  if (
    type === 'WIDE' ||
    type === 'MEDIUM' ||
    type === 'POV' ||
    type === 'DETAIL' ||
    type === 'PLAN' ||
    type === 'LIGHTING' ||
    type === 'EXPRESSION' ||
    type === 'CINEMATIC_COMPOSITE'
  ) {
    return '16:9';
  }
  return '3:4';
}

export function vaultAspectClass(type) {
  const ratio = shotAspectRatio(type);
  if (ratio === '1:1') return 'aspect-square';
  if (ratio === '3:4') return 'aspect-[3/4]';
  return 'aspect-video';
}
