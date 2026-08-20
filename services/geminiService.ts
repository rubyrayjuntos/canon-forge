
import { CharacterProfile, SetProfile, ReferenceType, SetReferenceType, CompositeConfig } from "../types";
import { AESTHETIC_PROMPT_CORE, CHARACTER_TEMPLATES, SET_TEMPLATES } from "../constants";
import {
  buildCharacterIdentityBlock,
  HEADSHOT_NEGATIVE_CONSTRAINTS,
  setLockReferenceUrl,
  shouldUseInitImage,
  shotAspectRatio,
} from "../utils/identityLock.js";

interface GenerationResult {
  url: string;
  prompt: string;
}

const DEFAULT_CHARACTER_NEGATIVE_CONSTRAINTS = [
  'triptych',
  'diptych',
  'contact sheet',
  'split screen',
  'collage',
  'duplicate person',
  'repeated body',
  'multiple panels',
  'cropped head',
  'cropped feet',
  'bad anatomy',
  'extra limbs',
  'fused fingers',
  'plastic skin',
].join(', ');

function filled(value: any, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s ? s : fallback;
}

function buildUndergarmentLine(profile: CharacterProfile): string {
  if (profile.undergarmentType === 'None') {
    return 'Undergarments: None (non-sexual, clinical life drawing reference).';
  }
  const parts = [profile.undergarmentType];
  if (profile.undergarmentFit) parts.push(`${profile.undergarmentFit} fit`);
  if (profile.undergarmentStyle) parts.push(profile.undergarmentStyle);
  return `Undergarments: ${parts.join(', ')}.`;
}

export interface ProviderConfig {
  provider: 'gemini' | 'venice' | 'aws' | 'xai' | 'local-llm';
  model: string;
}

let activeProviderConfig: ProviderConfig = { provider: 'xai', model: 'grok-imagine-image' };

export function setProviderConfig(config: ProviderConfig) {
  activeProviderConfig = config;
}

async function callGemini(
  prompt: string,
  seed: number,
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9",
  referenceImage?: string,
  awsCredentials?: any,
  options?: { useInitImage?: boolean; referenceImages?: string[]; provider?: ProviderConfig['provider']; model?: string }
): Promise<GenerationResult> {
  try {
    const provider = options?.provider || activeProviderConfig.provider;
    const model = options?.model || activeProviderConfig.model;
    const refs = [referenceImage, ...(options?.referenceImages || [])].filter(
      (url): url is string => Boolean(url)
    );
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt, seed, aspectRatio,
        provider: provider === 'local-llm' ? 'local-sd' : provider,
        model,
        referenceImage: refs[0],
        referenceImages: refs,
        useInitImage: options?.useInitImage,
        awsCredentials,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'GENERATION_FAILED');
    }
    return data as GenerationResult;
  } catch (error: any) {
    if (error.message === 'AUTH_REQUIRED') throw new Error('AUTH_REQUIRED');
    if (error.message === 'KEY_LEAKED')
      throw new Error('Gemini API key was reported as leaked. Replace GEMINI_API_KEY in .env.');
    if (error.message === 'INSUFFICIENT_BALANCE')
      throw new Error('Venice has no remaining credits. Top up at venice.ai/settings/api.');
    if (error.message === 'TIMEOUT')
      throw new Error('Generation timed out. Please try again.');
    if (error.message === 'MODEL_UNAVAILABLE')
      throw new Error('Model is busy right now. Please try again in a moment.');
    if (error.message === 'RATE_LIMITED')
      throw new Error('Rate limit reached. Please wait a minute and try again.');
    if (error.message === 'SAFETY_BLOCK')
      throw new Error('The selected provider rejected this image request.');
    if (error.message === 'NO_RESULT' || error.message === 'NO_IMAGE_DATA')
      throw new Error('No image returned. Please try again.');
    throw error;
  }
}

export function buildCharacterPrompt(
  profile: CharacterProfile,
  type: ReferenceType,
  options?: { attachFace?: boolean }
): string {
  const nudeReferenceTypes: ReferenceType[] = [
    'BODY_NUDE',
    'BODY_NUDE_FRONT',
    'BODY_NUDE_THREE_QUARTER',
    'BODY_NUDE_PROFILE',
    'BODY_NUDE_BACK',
  ];
  const isNudeReference = nudeReferenceTypes.includes(type);
  const undergarmentLine = (type === 'BODY_REVERSE' || isNudeReference)
    ? (isNudeReference ? 'Undergarments: None.' : buildUndergarmentLine(profile))
    : '';
  const isHeadshot = type === 'HEADSHOT';
  const identityBlock = buildCharacterIdentityBlock(profile, {
    hasFaceReference: Boolean(options?.attachFace),
    shotType: type,
  });
  const anatomyConstraints = isNudeReference
    ? 'Composition constraints: character reference plate, full body visible head-to-toe, no crop on head/hands/feet, subject occupies ~85% of frame, camera height around sternum. Preserve realistic clavicles, hands, feet, musculature, and skin texture.'
    : type === 'BODY_REVERSE'
      ? 'Composition constraints: natural proportions, no vertical compression or stretched limbs, full body head-to-toe, standing, camera at mid-torso. Use the selected body-study wardrobe exactly.'
      : type === 'WARDROBE' || type === 'ACTION' || type === 'NEUTRAL_SHEET'
        ? 'Composition constraints: natural adult proportions, no vertical compression or stretched limbs, full body head-to-toe in a 3:4 frame.'
        : '';
  const detailPriority = isHeadshot
    ? 'Detail priority: the face is the entire job. If the model wants a cinematic hero shot, still crop at the clavicle.'
    : 'Detail priority: If multi-view layout reduces fidelity, prioritize a single anatomically accurate full-body render with identity retention.';
  const negatives = isHeadshot
    ? HEADSHOT_NEGATIVE_CONSTRAINTS
    : DEFAULT_CHARACTER_NEGATIVE_CONSTRAINTS;
  return `${AESTHETIC_PROMPT_CORE}
    ${identityBlock}
    Scene: ${CHARACTER_TEMPLATES[type]}
    ${anatomyConstraints}
    ${detailPriority}
    ${undergarmentLine}
    Negative constraints: ${negatives}.
    Style: High-fidelity cinematic photography. Strict facial and anatomical consistency.`.trim();
}

export async function generateCharacterImage(
  profile: CharacterProfile,
  type: ReferenceType,
  awsCredentials?: any,
  providerOverride?: Partial<ProviderConfig>
): Promise<GenerationResult> {
  const faceRef = type === 'HEADSHOT' && !profile.canonHeadshotUrl ? undefined : profile.canonHeadshotUrl;
  const provider = providerOverride?.provider || activeProviderConfig.provider;
  const useInit = Boolean(faceRef) && shouldUseInitImage({
    provider,
    forgeType: 'CharacterForge',
    type,
  });
  const attachFace = Boolean(faceRef) && (provider === 'gemini' || useInit);
  const prompt = buildCharacterPrompt(profile, type, { attachFace });
  return callGemini(
    prompt,
    profile.seed,
    shotAspectRatio(type) as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
    attachFace ? faceRef : undefined,
    awsCredentials,
    {
      provider,
      model: providerOverride?.model,
      useInitImage: useInit,
    }
  );
}

export async function generateSetImage(
  profile: SetProfile,
  type: SetReferenceType,
  awsCredentials?: any
): Promise<GenerationResult> {
  const prompt = buildSetPrompt(profile, type);
  const setRef = setLockReferenceUrl(profile, type);
  return callGemini(prompt, profile.seed, "16:9", setRef, awsCredentials, {
    useInitImage: Boolean(setRef) && shouldUseInitImage({
      provider: activeProviderConfig.provider,
      forgeType: 'SetForge',
      type,
    }),
  });
}

export function buildSetPrompt(
  profile: SetProfile,
  type: SetReferenceType
): string {
  const setName = filled(profile.name, 'Unnamed location');
  const setType = filled(profile.locationType, 'Indoor');
  const style = filled(profile.style, 'Urban spiritual realism');
  const ambiance = filled(profile.ambiance, 'quiet cinematic tension');
  const lighting = filled(profile.lighting, 'soft cinematic key + controlled fill');
  const details = filled(profile.details, 'textured concrete, practical fixtures, subtle atmospheric haze');
  const spatialInvariants = filled(
    profile.spatialInvariants,
    'Preserve room proportions and core circulation geometry.'
  );
  const fixedLandmarks = filled(
    profile.fixedLandmarks,
    'Preserve entry, focal structure, and window placement.'
  );
  const forbiddenChanges = filled(
    profile.forbiddenChanges,
    'Do not relocate major architectural elements or invert layout.'
  );
  const lightingRigLock = filled(
    profile.lightingRigLock,
    'Key camera-left 45 degrees, low-ratio fill, subtle rim, controlled haze.'
  );

  return `${AESTHETIC_PROMPT_CORE}
    Environment: ${setName}, a ${setType} location. 
    Aesthetic: ${style}. Ambiance: ${ambiance}. 
    Lighting Specs: ${lighting}. Details: ${details}.
    Spatial Invariants (LOCKED): ${spatialInvariants}
    Fixed Landmarks (LOCKED): ${fixedLandmarks}
    Forbidden Changes: ${forbiddenChanges}
    Lighting Rig Lock (LOCKED): ${lightingRigLock}
    Composition: ${SET_TEMPLATES[type]}
    Style: High-fidelity architectural photography.`.trim();
}

export async function generateCompositeImage(
  char: CharacterProfile,
  set: SetProfile,
  config: CompositeConfig,
  awsCredentials?: any
): Promise<GenerationResult> {
  const provider = activeProviderConfig.provider;
  const useInit = Boolean(char.canonHeadshotUrl) && shouldUseInitImage({
    provider,
    forgeType: 'CompositorForge',
    type: 'CINEMATIC_COMPOSITE',
  });
  const attachFace = Boolean(char.canonHeadshotUrl) && (provider === 'gemini' || useInit);
  const identityBlock = buildCharacterIdentityBlock(char, {
    hasFaceReference: attachFace,
  });
  const setName = filled(set.name, 'Unnamed location');
  const setType = filled(set.locationType, 'Urban');
  const setStyle = filled(set.style, 'Urban spiritual realism');
  const setLighting = filled(set.lighting, 'subtle cinematic key/fill');
  const setDetails = filled(set.details, 'textured concrete, atmospheric haze, reflective surfaces');
  const setAmbiance = filled(set.ambiance, 'quiet tension and anticipation');
  const spatialInvariants = filled(
    set.spatialInvariants,
    'Preserve room proportions and circulation geometry.'
  );
  const fixedLandmarks = filled(
    set.fixedLandmarks,
    'Preserve entry, focal structure, and window placement.'
  );
  const forbiddenChanges = filled(
    set.forbiddenChanges,
    'Do not relocate major architectural elements or invert layout.'
  );
  const lightingRigLock = filled(
    set.lightingRigLock,
    'Key camera-left 45 degrees, low-ratio fill, subtle rim, controlled haze.'
  );
  const action = filled(config.action, 'standing in a grounded, story-rich pause');
  const extraActors = filled(config.extraActors, 'None');
  const compositionStyle = filled(config.compositionStyle, 'High-fidelity cinematic shot');
  const shotType = filled(config.shotType, 'master');
  const cameraAngle = filled(config.cameraAngle, 'eye_level');
  const lensPreset = filled(config.lensPreset, '35mm');
  const subjectDistance = filled(config.subjectDistance, 'medium');
  const emotionTone = filled(config.emotionTone, 'quiet resolve and focused anticipation');
  const landmarkLock = filled(
    config.landmarkLock,
    'Preserve established set landmarks and relative spacing from SetForge.'
  );
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Scene Composition: Merge Character and Environment seamlessly.
    ${identityBlock}
    Note: The face must match exactly with the character's core facial traits.

    Environment Context: ${setName}, ${setType}, style ${setStyle}, ${setLighting} lighting. ${setDetails}.
    Spatial Invariants (LOCKED): ${spatialInvariants}
    Fixed Landmarks (LOCKED): ${fixedLandmarks}
    Forbidden Changes: ${forbiddenChanges}
    Lighting Rig Lock (LOCKED): ${lightingRigLock}

    Action: ${action}.
    Additional Details/Actors: ${extraActors}.
    Shot Contract (LOCKED): shot_type=${shotType}, camera_angle=${cameraAngle}, lens=${lensPreset}, subject_distance=${subjectDistance}, emotion_tone=${emotionTone}.
    Landmark Lock (LOCKED): ${landmarkLock}
    ${attachFace ? 'Character face is locked to the attached canon headshot.' : ''}
    ${set.canonWideUrl || set.canonMediumUrl ? 'Environment is locked to established wide/medium coverage. Match architecture, materials, and lighting.' : ''}

    Integration Logic: Place the character physically in the environment. Match local lighting, shadows, and color bounce from the ${setLighting}.
    Atmospheric depth should match the ${setAmbiance}.

    Style: ${compositionStyle}.`.trim();

  const setLock = set.canonWideUrl || set.canonMediumUrl;
  return callGemini(prompt, char.seed, "16:9", attachFace ? char.canonHeadshotUrl : undefined, awsCredentials, {
    referenceImages: [attachFace ? char.canonHeadshotUrl : undefined, setLock].filter(
      (url): url is string => Boolean(url)
    ),
    useInitImage: useInit,
  });
}
