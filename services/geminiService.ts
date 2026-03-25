
import { CharacterProfile, SetProfile, ReferenceType, SetReferenceType, CompositeConfig } from "../types";
import { AESTHETIC_PROMPT_CORE, AESTHETIC_PROMPT_CORE_FAST, CHARACTER_TEMPLATES, SET_TEMPLATES } from "../constants";

interface GenerationResult {
  url: string;
  prompt: string;
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
  provider: 'gemini' | 'venice';
  model: string;
}

let activeProviderConfig: ProviderConfig = { provider: 'gemini', model: 'gemini-3-pro-image-preview' };

export function setProviderConfig(config: ProviderConfig) {
  activeProviderConfig = config;
}

async function callGemini(
  prompt: string,
  seed: number,
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9",
  fastRender: boolean,
  referenceImage?: string
): Promise<GenerationResult> {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt, seed, aspectRatio, fastRender,
        provider: activeProviderConfig.provider,
        model: activeProviderConfig.model,
        referenceImage,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'GENERATION_FAILED');
    }
    return data as GenerationResult;
  } catch (error: any) {
    if (error.message === 'AUTH_REQUIRED') throw new Error('AUTH_REQUIRED');
    if (error.message === 'TIMEOUT')
      throw new Error('Generation timed out. Please try again.');
    if (error.message === 'MODEL_UNAVAILABLE')
      throw new Error('Model is busy right now. Please try again in a moment.');
    if (error.message === 'RATE_LIMITED')
      throw new Error('Rate limit reached. Please wait a minute and try again.');
    if (error.message === 'SAFETY_BLOCK')
      throw new Error('Blocked by safety filters. Try a different prompt.');
    if (error.message === 'NO_RESULT' || error.message === 'NO_IMAGE_DATA')
      throw new Error('No image returned. Please try again.');
    throw error;
  }
}

export async function generateCharacterImage(
  profile: CharacterProfile,
  type: ReferenceType,
  fastRender: boolean
): Promise<GenerationResult> {
  const core = fastRender ? AESTHETIC_PROMPT_CORE_FAST : AESTHETIC_PROMPT_CORE;
  const undergarmentLine = (type === 'BODY_REVERSE' || type === 'BODY_NUDE')
    ? (type === 'BODY_NUDE' ? 'Undergarments: None (non-sexual, clinical life drawing reference).' : buildUndergarmentLine(profile))
    : '';
  const wardrobeLine = profile.wardrobe ? `Signature Wardrobe: ${profile.wardrobe}.` : '';
  const prompt = `${core}
    Subject: Character ${profile.name}, ${profile.age}y/o ${profile.gender}, ${profile.build} build, ${profile.skinTone} skin, ${profile.eyes} eyes, ${profile.hair} hair. ${profile.distinctiveFeatures}.
    ${wardrobeLine}
    Scene: ${CHARACTER_TEMPLATES[type]}
    ${undergarmentLine}
    Style: High-fidelity cinematic photography. Strict facial and anatomical consistency.`.trim();
  return callGemini(prompt, profile.seed, (type === 'BODY_REVERSE' || type === 'BODY_NUDE') ? "3:4" : "16:9", fastRender, profile.canonHeadshotUrl);
}

export async function generateSetImage(
  profile: SetProfile,
  type: SetReferenceType,
  fastRender: boolean
): Promise<GenerationResult> {
  const core = fastRender ? AESTHETIC_PROMPT_CORE_FAST : AESTHETIC_PROMPT_CORE;
  const prompt = `${core}
    Environment: ${profile.name}, a ${profile.locationType} location. 
    Aesthetic: ${profile.style}. Ambiance: ${profile.ambiance}. 
    Lighting Specs: ${profile.lighting}. Details: ${profile.details}.
    Composition: ${SET_TEMPLATES[type]}
    Style: High-fidelity architectural photography.`.trim();
  return callGemini(prompt, profile.seed, "16:9", fastRender);
}

export async function generateCompositeImage(
  char: CharacterProfile,
  set: SetProfile,
  config: CompositeConfig,
  fastRender: boolean
): Promise<GenerationResult> {
  const core = fastRender ? AESTHETIC_PROMPT_CORE_FAST : AESTHETIC_PROMPT_CORE;
  // Enhanced detail injection to force identity lock
  const wardrobeLine = char.wardrobe ? `Signature Wardrobe: ${char.wardrobe}.` : '';
  const prompt = `${core}
    Scene Composition: Merge Character and Environment seamlessly.
    Character Visual Identity (MANDATORY): ${char.name}, ${char.age}y/o ${char.gender}, ${char.build} build, ${char.skinTone} skin, ${char.eyes} eyes, ${char.hair} hair. ${char.distinctiveFeatures}.
    Note: The face must match exactly with the character's core facial traits.
    ${wardrobeLine}

    Environment Context: ${set.name}, ${set.locationType}, style ${set.style}, ${set.lighting} lighting. ${set.details}.

    Action: ${config.action}.
    Additional Details/Actors: ${config.extraActors || 'None'}.

    Integration Logic: Place the character physically in the environment. Match local lighting, shadows, and color bounce from the ${set.lighting}.
    Atmospheric depth should match the ${set.ambiance}.

    Style: ${config.compositionStyle || 'High-fidelity cinematic shot'}.`.trim();

  // Character seed is the identity anchor
  return callGemini(prompt, char.seed, "16:9", fastRender, char.canonHeadshotUrl);
}
