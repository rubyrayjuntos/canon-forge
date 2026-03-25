import { CharacterProfile, SetProfile, Keyframe, KeyframeScene } from '../types';
import { AESTHETIC_PROMPT_CORE } from '../constants';
import { ProviderConfig } from './geminiService';

// Exported so SceneForgePanel can call it directly for single-frame regeneration
export function buildKeyframePrompt(
  char: CharacterProfile,
  set: SetProfile,
  sceneAction: string,
  frameIndex: number,
  frameCount: number,
  timestampSeconds: number,
  beat: string // empty string in auto mode, user text in manual mode
): string {
  const isAuto = beat.trim() === '';
  let temporalStage: string;

  if (isAuto) {
    if (frameIndex === 0) {
      temporalStage = `Scene opening. ${sceneAction}: just beginning.`;
    } else if (frameIndex === frameCount - 1) {
      temporalStage = `Scene end. ${sceneAction}: complete.`;
    } else {
      const fraction = Math.round((frameIndex / (frameCount - 1)) * 100);
      temporalStage = `Scene midpoint at ${timestampSeconds}s. ${sceneAction}: ${fraction}% complete.`;
    }
  } else {
    temporalStage = beat.trim();
  }

  return `${AESTHETIC_PROMPT_CORE}
    Scene Composition: Character in environment.
    Character (MANDATORY IDENTITY): ${char.name}, ${char.age}y/o ${char.gender}, ${char.build} build, ${char.skinTone} skin, ${char.eyes} eyes, ${char.hair} hair. ${char.distinctiveFeatures}.
    Environment: ${set.name}, ${set.locationType}, ${set.style} style, ${set.lighting} lighting. ${set.details}.
    Action: ${temporalStage}
    Style: High-fidelity cinematic photography. Keyframe ${frameIndex + 1} of ${frameCount}.`.trim();
}

export function computeFrameCount(totalDuration: number, intervalSeconds: number): number {
  const interval = Math.max(1, Math.min(8, intervalSeconds));
  const duration = Math.max(0, totalDuration);
  return Math.floor(duration / interval) + 1;
}

export async function generateKeyframeSequence(
  char: CharacterProfile,
  set: SetProfile,
  scene: KeyframeScene,
  providerConfig: ProviderConfig,
  onFrameUpdate: (frameIndex: number, update: Partial<Keyframe>) => void
): Promise<void> {
  const interval = Math.max(1, Math.min(8, scene.intervalSeconds)); // guard
  const frameCount = computeFrameCount(scene.totalDuration, interval);

  const CONCURRENCY = 4;
  const indices = Array.from({ length: frameCount }, (_, i) => i);

  for (let batch = 0; batch < indices.length; batch += CONCURRENCY) {
    const batchIndices = indices.slice(batch, batch + CONCURRENCY);
    await Promise.all(
      batchIndices.map(async (i) => {
        const timestampSeconds = i * interval;
        const beat = scene.manualBeats[i] ?? '';
        const prompt = buildKeyframePrompt(char, set, scene.sceneAction, i, frameCount, timestampSeconds, beat);

        onFrameUpdate(i, { status: 'generating', promptUsed: prompt });

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              seed: char.seed,
              aspectRatio: '16:9',
              fastRender: true,
              provider: providerConfig.provider,
              model: providerConfig.model,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) {
            onFrameUpdate(i, { status: 'error' });
          } else {
            onFrameUpdate(i, { status: 'done', url: data.url });
          }
        } catch {
          onFrameUpdate(i, { status: 'error' });
        }
      })
    );
  }
}
