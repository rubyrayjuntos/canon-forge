# SceneForge Keyframe Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth "SceneForge" tab to CanonForge that generates a temporally-staged series of keyframe images for a scene and plays them as a flipbook.

**Architecture:** Five tasks in dependency order — types first, then the service layer, then two new components, then wire everything into App.tsx. No server changes needed; all generation reuses the existing `/api/generate` endpoint. State lives in App.tsx and is passed down as props.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (utility classes, same as rest of app), existing `/api/generate` endpoint with `fastRender: true`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `types.ts` | Add `Keyframe`, `KeyframeScene` interfaces; add `'SceneForge'` to `AppTab` |
| Modify | `constants.ts` | No change needed (tab label derived from `AppTab` string in nav) |
| Create | `services/keyframeService.ts` | Temporal prompt builder + parallel generation function |
| Create | `components/FlipbookPlayer.tsx` | Filmstrip thumbnails + preview window + play controls |
| Create | `components/SceneForgePanel.tsx` | Config bar + manual beats + FlipbookPlayer + scene history |
| Modify | `App.tsx` | Add `keyframeScenes` state, add `'SceneForge'` to tab array, render `SceneForgePanel` |

---

## Task 1: Extend types.ts

**Files:**
- Modify: `types.ts`

### Context
`AppTab` is a union type used throughout App.tsx for tab switching. The tab nav on line 530 of App.tsx iterates over `(['CharacterForge', 'SetForge', 'CompositorForge'] as AppTab[])` — that array also needs updating in Task 5, but the type must exist first.

- [ ] **Step 1: Add `'SceneForge'` to the `AppTab` union**

Open `types.ts`. Change:
```ts
export type AppTab = 'CharacterForge' | 'SetForge' | 'CompositorForge';
```
To:
```ts
export type AppTab = 'CharacterForge' | 'SetForge' | 'CompositorForge' | 'SceneForge';
```

- [ ] **Step 2: Add `Keyframe` and `KeyframeScene` interfaces**

Append to the bottom of `types.ts`:
```ts
export interface Keyframe {
  id: string;
  frameIndex: number;        // 0-based
  timestampSeconds: number;  // e.g. 0, 8, 16, 24, 32
  url: string;
  promptUsed: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

export interface KeyframeScene {
  id: string;
  characterId: string;       // foreign key into CharacterProfile[] state
  setId: string;             // foreign key into SetProfile[] state
  characterName: string;     // denormalized for display
  setName: string;           // denormalized for display
  sceneAction: string;
  totalDuration: number;     // seconds
  intervalSeconds: number;   // 1–8
  mode: 'auto' | 'manual';
  manualBeats: string[];     // always length === frameCount, even in auto mode
  frames: Keyframe[];
  createdAt: number;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build 2>&1 | grep -E "error TS|warning"`

Expected: no TypeScript errors related to the new types. (Existing code may have pre-existing warnings — ignore those.)

- [ ] **Step 4: Commit**

```bash
git add types.ts
git commit -m "feat: add Keyframe, KeyframeScene types and SceneForge to AppTab"
```

---

## Task 2: Create keyframeService.ts

**Files:**
- Create: `services/keyframeService.ts`

### Context
This service has two exported functions:
1. `buildKeyframePrompt` — constructs the prompt for a single frame
2. `generateKeyframeSequence` — fires all frame generations in parallel and calls `onFrameUpdate` as each one settles

It imports `AESTHETIC_PROMPT_CORE` from `constants.ts` (same as `geminiService.ts`) and calls `/api/generate` via the same `fetch` pattern used in `geminiService.ts`. The globally selected provider/model is passed in (App.tsx manages it).

Frame count formula: `Math.floor(totalDuration / intervalSeconds) + 1`

- [ ] **Step 1: Create the file with imports and the prompt builder**

Create `services/keyframeService.ts`:
```ts
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
```

- [ ] **Step 2: Add the `generateKeyframeSequence` function**

Append to `services/keyframeService.ts`:
```ts
export function computeFrameCount(totalDuration: number, intervalSeconds: number): number {
  const interval = Math.max(1, Math.min(8, intervalSeconds));
  return Math.floor(totalDuration / interval) + 1;
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

  const framePromises = Array.from({ length: frameCount }, (_, i) => {
    const timestampSeconds = i * interval;
    const beat = scene.manualBeats[i] ?? '';
    const prompt = buildKeyframePrompt(char, set, scene.sceneAction, i, frameCount, timestampSeconds, beat);

    onFrameUpdate(i, { status: 'generating', promptUsed: prompt });

    return fetch('/api/generate', {
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
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.url) {
          onFrameUpdate(i, { status: 'error' });
        } else {
          onFrameUpdate(i, { status: 'done', url: data.url });
        }
      })
      .catch(() => {
        onFrameUpdate(i, { status: 'error' });
      });
  });

  await Promise.all(framePromises);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build 2>&1 | grep "error TS"`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add services/keyframeService.ts
git commit -m "feat: add keyframeService with temporal prompt builder and parallel generation"
```

---

## Task 3: Create FlipbookPlayer.tsx

**Files:**
- Create: `components/FlipbookPlayer.tsx`

### Context
This is a self-contained presentational component. It receives frames as props and fires callbacks for user actions (thumbnail click, regenerate). App/SceneForgePanel owns all state — this component only renders and calls callbacks.

The play loop uses `useInterval`-style logic: a `useEffect` sets up a `setInterval` when `isPlaying` is true, advances `activeIndex`, and clears on teardown.

Play button is disabled until at least one frame has `status === 'done'`.

- [ ] **Step 1: Create the file with the filmstrip and preview window**

Create `components/FlipbookPlayer.tsx`:
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Keyframe } from '../types';

interface FlipbookPlayerProps {
  frames: Keyframe[];
  totalDuration: number;
  intervalSeconds: number;
  onRegenerateFrame: (frameIndex: number) => void;
}

const FlipbookPlayer: React.FC<FlipbookPlayerProps> = ({
  frames,
  totalDuration,
  intervalSeconds,
  onRegenerateFrame,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canPlay = frames.some((f) => f.status === 'done');
  const activeFrame = frames[activeIndex];

  // Reset active index when frames array changes length (new scene)
  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
  }, [frames.length]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % frames.length);
    }, 1000 / fps);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, fps, frames.length]);

  return (
    <div className="flex flex-col gap-4">
      {/* Preview window */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
        {activeFrame?.status === 'done' && activeFrame.url ? (
          <img src={activeFrame.url} className="w-full h-full object-cover" alt={`Frame ${activeIndex + 1}`} />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <i className="fas fa-film text-3xl"></i>
            <span className="text-xs font-mono">
              {activeFrame?.status === 'generating' ? 'Generating...' : 'Pending'}
            </span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 bg-black/60 rounded-lg px-3 py-1 text-xs font-mono text-slate-300">
          Frame {activeIndex + 1} of {frames.length} · {activeIndex * intervalSeconds}s / {totalDuration}s
        </div>
      </div>

      {/* Filmstrip */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {frames.map((frame, i) => (
          <FrameThumbnail
            key={frame.id}
            frame={frame}
            index={i}
            isActive={i === activeIndex}
            intervalSeconds={intervalSeconds}
            onClick={() => setActiveIndex(i)}
            onRegenerate={() => onRegenerateFrame(i)}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsPlaying((p) => !p)}
          disabled={!canPlay}
          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <i className={`fas fa-${isPlaying ? 'pause' : 'play'} text-sm`}></i>
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Speed</span>
          <input
            type="range"
            min={1}
            max={8}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-24 accent-indigo-500"
          />
          <span className="font-mono w-8">{fps} fps</span>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add the `FrameThumbnail` sub-component**

Append to `components/FlipbookPlayer.tsx` (before the `export default`):
```tsx
const FrameThumbnail: React.FC<{
  frame: Keyframe;
  index: number;
  isActive: boolean;
  intervalSeconds: number;
  onClick: () => void;
  onRegenerate: () => void;
}> = ({ frame, index, isActive, intervalSeconds, onClick, onRegenerate }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
        isActive ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : frame.status === 'error' ? 'border-red-700' : 'border-slate-700 hover:border-slate-500'
      }`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {frame.status === 'done' && frame.url ? (
        <img src={frame.url} className="w-full h-full object-cover" alt={`Frame ${index + 1}`} />
      ) : frame.status === 'generating' ? (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <i className="fas fa-circle-notch fa-spin text-indigo-400"></i>
        </div>
      ) : (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <i className={`fas ${frame.status === 'error' ? 'fa-exclamation-triangle text-red-500' : 'fa-clock text-slate-600'}`}></i>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
        {index * intervalSeconds}s
      </div>
      {hovered && (frame.status === 'done' || frame.status === 'error') && (
        <button
          onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
          className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 transition-colors"
          title="Regenerate frame"
        >
          <i className="fas fa-redo text-[8px]"></i>
        </button>
      )}
    </div>
  );
};

export default FlipbookPlayer;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build 2>&1 | grep "error TS"`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/FlipbookPlayer.tsx
git commit -m "feat: add FlipbookPlayer component with filmstrip, preview, and playback controls"
```

---

## Task 4: Create SceneForgePanel.tsx

**Files:**
- Create: `components/SceneForgePanel.tsx`

### Context
This is the full tab UI. It:
1. Renders the config bar (character/set selectors, scene action, duration, interval, mode toggle, Forge button)
2. In manual mode, renders one text input per frame (beat descriptions)
3. Calls `generateKeyframeSequence` from `keyframeService` when the user clicks Forge
4. Holds `activeScene` state (the currently displayed `KeyframeScene`) and `sceneHistory` state
5. Uses a `useEffect` to detect when all frames have settled and appends to history
6. Renders `FlipbookPlayer` and the history list

Character and set options available for selection: `[charProfile, ...savedChars]` (current editing profile + all saved profiles) — same pattern as the compositor selector in App.tsx (lines 779–791).

- [ ] **Step 1: Create the file with imports, state, and the config bar**

Create `components/SceneForgePanel.tsx`:
```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { CharacterProfile, SetProfile, Keyframe, KeyframeScene } from '../types';
import { ProviderConfig } from '../services/geminiService';
import { buildKeyframePrompt, generateKeyframeSequence, computeFrameCount } from '../services/keyframeService';
import FlipbookPlayer from './FlipbookPlayer';

interface SceneForgePanelProps {
  charProfile: CharacterProfile;
  savedChars: CharacterProfile[];
  setProfile: SetProfile;
  savedSets: SetProfile[];
  providerConfig: ProviderConfig;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const SceneForgePanel: React.FC<SceneForgePanelProps> = ({
  charProfile,
  savedChars,
  setProfile,
  savedSets,
  providerConfig,
}) => {
  const allChars = [charProfile, ...savedChars.filter((c) => c.id !== charProfile.id)];
  const allSets = [setProfile, ...savedSets.filter((s) => s.id !== setProfile.id)];

  const [selectedCharId, setSelectedCharId] = useState<string>(charProfile.id);
  const [selectedSetId, setSelectedSetId] = useState<string>(setProfile.id);
  const [sceneAction, setSceneAction] = useState('');
  const [totalDuration, setTotalDuration] = useState(32);
  const [intervalSeconds, setIntervalSeconds] = useState(8);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualBeats, setManualBeats] = useState<string[]>([]);
  const [isForging, setIsForging] = useState(false);

  const [activeScene, setActiveScene] = useState<KeyframeScene | null>(null);
  const [sceneHistory, setSceneHistory] = useState<KeyframeScene[]>([]);

  const frameCount = computeFrameCount(totalDuration, intervalSeconds);

  // Keep manualBeats in sync with frameCount regardless of mode
  useEffect(() => {
    setManualBeats((prev) => {
      if (prev.length === frameCount) return prev;
      if (prev.length > frameCount) return prev.slice(0, frameCount);
      return [...prev, ...Array(frameCount - prev.length).fill('')];
    });
  }, [frameCount]);

  // Append to history when all frames have settled
  useEffect(() => {
    if (!activeScene) return;
    const allSettled = activeScene.frames.every(
      (f) => f.status === 'done' || f.status === 'error'
    );
    if (!allSettled) return;
    const alreadyInHistory = sceneHistory.some((s) => s.id === activeScene.id);
    if (!alreadyInHistory) {
      setSceneHistory((prev) => [activeScene, ...prev]);
    }
  }, [activeScene?.frames]);

  const handleFrameUpdate = useCallback((frameIndex: number, update: Partial<Keyframe>) => {
    setActiveScene((prev) => {
      if (!prev) return prev;
      const frames = prev.frames.map((f, i) =>
        i === frameIndex ? { ...f, ...update } : f
      );
      return { ...prev, frames };
    });
  }, []);

  const handleRegenerate = useCallback(async (frameIndex: number) => {
    if (!activeScene) return;
    const char = allChars.find((c) => c.id === activeScene.characterId);
    const set = allSets.find((s) => s.id === activeScene.setId);
    if (!char || !set) return;

    // Build the prompt for just this one frame — same function used by the service
    const interval = activeScene.intervalSeconds;
    const frameCount = activeScene.frames.length;
    const timestampSeconds = frameIndex * interval;
    const beat = activeScene.manualBeats[frameIndex] ?? '';
    const prompt = buildKeyframePrompt(char, set, activeScene.sceneAction, frameIndex, frameCount, timestampSeconds, beat);

    handleFrameUpdate(frameIndex, { status: 'generating', url: '', promptUsed: prompt });

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
        handleFrameUpdate(frameIndex, { status: 'error' });
      } else {
        handleFrameUpdate(frameIndex, { status: 'done', url: data.url });
      }
    } catch {
      handleFrameUpdate(frameIndex, { status: 'error' });
    }
  }, [activeScene, allChars, allSets, providerConfig, handleFrameUpdate]);
```

- [ ] **Step 2: Add the `handleForge` function and the JSX return**

Append to `SceneForgePanel.tsx` (still inside the component, before closing brace):
```tsx
  const handleForge = async () => {
    const char = allChars.find((c) => c.id === selectedCharId) ?? charProfile;
    const set = allSets.find((s) => s.id === selectedSetId) ?? setProfile;
    const clampedInterval = Math.max(1, Math.min(8, intervalSeconds));
    const count = computeFrameCount(totalDuration, clampedInterval);

    const initialFrames: Keyframe[] = Array.from({ length: count }, (_, i) => ({
      id: generateId(),
      frameIndex: i,
      timestampSeconds: i * clampedInterval,
      url: '',
      promptUsed: '',
      status: 'pending' as const,
    }));

    const newScene: KeyframeScene = {
      id: generateId(),
      characterId: char.id,
      setId: set.id,
      characterName: char.name,
      setName: set.name,
      sceneAction,
      totalDuration,
      intervalSeconds: clampedInterval,
      mode,
      manualBeats: [...manualBeats],
      frames: initialFrames,
      createdAt: Date.now(),
    };

    setActiveScene(newScene);
    setIsForging(true);
    await generateKeyframeSequence(char, set, newScene, providerConfig, handleFrameUpdate);
    setIsForging(false);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Config Bar */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">Scene Configuration</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Character</label>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {allChars.map((c) => (
                <option key={c.id} value={c.id}>{c.name || 'Unnamed Character'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Set</label>
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {allSets.map((s) => (
                <option key={s.id} value={s.id}>{s.name || 'Unnamed Set'}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Scene Action</label>
          <input
            type="text"
            value={sceneAction}
            onChange={(e) => setSceneAction(e.target.value)}
            placeholder="e.g. walks to the window and looks out"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Duration (s)</label>
            <input
              type="number"
              min={8}
              max={300}
              value={totalDuration}
              onChange={(e) => setTotalDuration(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Interval (s, max 8)</label>
            <input
              type="number"
              min={1}
              max={8}
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Math.max(1, Math.min(8, Number(e.target.value))))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Frames</label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono">
              {frameCount}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Mode:</span>
          {(['auto', 'manual'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        {mode === 'manual' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Beat descriptions (one per frame):</p>
            {manualBeats.map((beat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">
                  {i * intervalSeconds}s
                </span>
                <input
                  type="text"
                  value={beat}
                  onChange={(e) => {
                    const next = [...manualBeats];
                    next[i] = e.target.value;
                    setManualBeats(next);
                  }}
                  placeholder={`Frame ${i + 1} beat`}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600"
                />
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleForge}
          disabled={isForging || !sceneAction.trim()}
          className="w-full bg-gradient-to-r from-violet-700 to-indigo-600 hover:from-violet-600 hover:to-indigo-500 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <i className={`fas ${isForging ? 'fa-circle-notch fa-spin' : 'fa-film'}`}></i>
          {isForging ? 'Forging Scene...' : `⚡ Forge Keyframes (${frameCount} frames)`}
        </button>
      </div>

      {/* Flipbook Player */}
      {activeScene && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase mb-4">
            Scene Preview — {activeScene.characterName} · {activeScene.sceneAction}
          </p>
          <FlipbookPlayer
            frames={activeScene.frames}
            totalDuration={activeScene.totalDuration}
            intervalSeconds={activeScene.intervalSeconds}
            onRegenerateFrame={handleRegenerate}
          />
        </div>
      )}

      {/* Scene History */}
      {sceneHistory.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase mb-4">Scene Archive</p>
          <div className="space-y-2">
            {sceneHistory.map((scene) => (
              <button
                key={scene.id}
                onClick={() => setActiveScene(scene)}
                className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{scene.characterName}</span>
                    <span className="text-slate-400 text-sm"> · {scene.sceneAction}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {scene.frames.length} frames · {new Date(scene.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneForgePanel;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build 2>&1 | grep "error TS"`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/SceneForgePanel.tsx
git commit -m "feat: add SceneForgePanel with config, flipbook player, and scene history"
```

---

## Task 5: Wire SceneForge into App.tsx

**Files:**
- Modify: `App.tsx`

### Context
Three changes to App.tsx:
1. Import `SceneForgePanel`
2. Add `'SceneForge'` to the tab nav array (line ~530)
3. Add the conditional render block for `activeTab === 'SceneForge'`

No new state needed in App.tsx — SceneForgePanel manages its own `activeScene` and `sceneHistory`. App.tsx just passes down `charProfile`, `savedChars`, `setProfile`, `savedSets`, and `providerConfig` as props (all already exist in App.tsx state).

- [ ] **Step 1: Add the import**

In `App.tsx`, add to the imports section (near the other component imports):
```ts
import SceneForgePanel from './components/SceneForgePanel';
```

- [ ] **Step 2: Add `'SceneForge'` to the tab nav array**

Find this line (~line 530):
```tsx
{(['CharacterForge', 'SetForge', 'CompositorForge'] as AppTab[]).map((t) => (
```
Change to:
```tsx
{(['CharacterForge', 'SetForge', 'CompositorForge', 'SceneForge'] as AppTab[]).map((t) => (
```

- [ ] **Step 3: Add the SceneForge tab render block**

Find the closing `)}` of the `CompositorForge` block (the last tab conditional, ~line 970). After it, add:
```tsx
{activeTab === 'SceneForge' && (
  <div className="animate-in fade-in duration-500">
    <SceneForgePanel
      charProfile={charProfile}
      savedChars={savedChars}
      setProfile={setProfile}
      savedSets={savedSets}
      providerConfig={providerConfig}
    />
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

Run: `npm run build 2>&1 | grep "error TS"`

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Open http://localhost:5173 and verify:
1. A "Scene" tab appears in the nav alongside Character, Set, Compositor
2. Clicking it shows the Scene Configuration panel
3. Character and Set dropdowns are populated with profiles from the other tabs
4. Changing Duration/Interval updates the Frames count immediately
5. Switching Mode to Manual shows beat input fields (one per frame)
6. Changing Duration re-syncs the beat fields (no lost inputs, correct count)
7. Click "Forge Keyframes" with a scene action — all frame thumbnails show spinners simultaneously (parallel generation confirmed)
8. As frames complete, thumbnails populate; Play button activates on first completed frame
9. Pressing Play animates the flipbook; Speed slider changes FPS
10. Hovering a completed thumbnail shows the ↻ regenerate button
11. After all frames settle, the scene appears in Scene Archive

- [ ] **Step 6: Commit**

```bash
git add App.tsx
git commit -m "feat: wire SceneForge tab into App with SceneForgePanel"
```

---

## Done

All five tasks complete. The SceneForge tab is live. Remaining improvements tracked as out-of-scope for v1:
- Full-res export / ZIP download
- Multi-scene stacking
- Google Flow direct integration
- localStorage persistence
