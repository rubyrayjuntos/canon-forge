import {
  CharacterProfile,
  SetProfile,
  ReferenceType,
  SetReferenceType,
  CompositeConfig,
} from '../types';
import { AESTHETIC_PROMPT_CORE, CHARACTER_TEMPLATES, SET_TEMPLATES } from '../constants';

const POLLINATIONS_BASE_URL = 'https://image.pollinations.ai/prompt';

interface GenerationResult {
  url: string;
  prompt: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Convert aspect ratio string to pixel dimensions
 * Using 1024 as base for high quality output
 */
function getImageDimensions(aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'): ImageDimensions {
  const dimensions: Record<string, ImageDimensions> = {
    '1:1': { width: 1024, height: 1024 },
    '3:4': { width: 768, height: 1024 },
    '4:3': { width: 1024, height: 768 },
    '9:16': { width: 576, height: 1024 },
    '16:9': { width: 1024, height: 576 },
  };
  return dimensions[aspectRatio] || dimensions['16:9'];
}

/**
 * Generate an image using Pollinations.ai
 * No API key required - completely free and permissive
 */
async function callPollinations(
  prompt: string,
  seed: number,
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '16:9'
): Promise<GenerationResult> {
  const { width, height } = getImageDimensions(aspectRatio);
  const safeSeed = Math.abs(Math.floor(seed));

  // Encode the prompt for URL - trim to avoid overly long URLs
  const trimmedPrompt = prompt.slice(0, 1500); // Pollinations has URL length limits
  const encodedPrompt = encodeURIComponent(trimmedPrompt);

  // Construct Pollinations URL with parameters
  const imageUrl = `${POLLINATIONS_BASE_URL}/${encodedPrompt}?seed=${safeSeed}&width=${width}&height=${height}&nologo=true&model=flux`;

  // Return the URL directly - Pollinations generates on-demand when the URL is accessed
  // No need to verify here as it adds latency and can fail due to CORS
  return {
    url: imageUrl,
    prompt: prompt,
  };
}

export async function generateCharacterImage(
  profile: CharacterProfile,
  type: ReferenceType
): Promise<GenerationResult> {
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Subject: Character ${profile.name}, ${profile.age}y/o ${profile.gender}, ${profile.build} build, ${profile.skinTone} skin, ${profile.eyes} eyes, ${profile.hair} hair. ${profile.distinctiveFeatures}.
    Scene: ${CHARACTER_TEMPLATES[type]}
    Style: High-fidelity cinematic photography. Strict facial and anatomical consistency.`.trim();
  return callPollinations(prompt, profile.seed, type === 'BODY_REVERSE' ? '3:4' : '16:9');
}

export async function generateSetImage(
  profile: SetProfile,
  type: SetReferenceType
): Promise<GenerationResult> {
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Environment: ${profile.name}, a ${profile.locationType} location. 
    Aesthetic: ${profile.style}. Ambiance: ${profile.ambiance}. 
    Lighting Specs: ${profile.lighting}. Details: ${profile.details}.
    Composition: ${SET_TEMPLATES[type]}
    Style: High-fidelity architectural photography.`.trim();
  return callPollinations(prompt, profile.seed, '16:9');
}

export async function generateCompositeImage(
  char: CharacterProfile,
  set: SetProfile,
  config: CompositeConfig
): Promise<GenerationResult> {
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Scene Composition: Merge Character and Environment seamlessly.
    Character Visual Identity (MANDATORY): ${char.name}, ${char.age}y/o ${char.gender}, ${char.build} build, ${char.skinTone} skin, ${char.eyes} eyes, ${char.hair} hair. ${char.distinctiveFeatures}. 
    Note: The face must match exactly with the character's core facial traits.
    
    Environment Context: ${set.name}, ${set.locationType}, style ${set.style}, ${set.lighting} lighting. ${set.details}.
    
    Action: ${config.action}.
    Additional Details/Actors: ${config.extraActors || 'None'}.
    
    Integration Logic: Place the character physically in the environment. Match local lighting, shadows, and color bounce from the ${set.lighting}. 
    Atmospheric depth should match the ${set.ambiance}.
    
    Style: ${config.compositionStyle || 'High-fidelity cinematic shot'}.`.trim();

  // Character seed is the identity anchor
  return callPollinations(prompt, char.seed, '16:9');
}
