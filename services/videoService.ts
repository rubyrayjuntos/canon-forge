import { CharacterProfile, SetProfile, CompositeConfig } from '../types';
import { AESTHETIC_PROMPT_CORE } from '../constants';

interface VideoResult {
  url: string;
  prompt: string;
}

async function callVideoGenerate(prompt: string): Promise<VideoResult> {
  const response = await fetch('/api/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json();
  if (!response.ok) {
    const err = data?.error || 'VIDEO_FAILED';
    if (err === 'TIMEOUT') throw new Error('Video generation timed out. Please try again.');
    if (err === 'RATE_LIMITED') throw new Error('Rate limit reached. Please wait and try again.');
    if (err === 'AUTH_REQUIRED') throw new Error('AUTH_REQUIRED');
    throw new Error('Video generation failed. Please try again.');
  }
  return data as VideoResult;
}

export async function generateCompositeVideo(
  char: CharacterProfile,
  set: SetProfile,
  config: CompositeConfig
): Promise<VideoResult> {
  const prompt = `${AESTHETIC_PROMPT_CORE}
    Cinematic video clip. Character: ${char.name}, ${char.age}y/o ${char.gender}, ${char.build} build, ${char.skinTone} skin, ${char.eyes} eyes, ${char.hair} hair. ${char.distinctiveFeatures}.
    Location: ${set.name}, ${set.locationType}, ${set.style} aesthetic, ${set.lighting} lighting, ${set.ambiance} ambiance.
    Action: ${config.action}.
    ${config.extraActors ? `Additional: ${config.extraActors}.` : ''}
    Style: Cinematic motion, shallow depth of field, film grain, indigo and amber color grading. 8-second continuous shot.`.trim();

  return callVideoGenerate(prompt);
}
