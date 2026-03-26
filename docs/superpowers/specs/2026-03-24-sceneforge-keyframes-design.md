# SceneForge — Keyframe Sequence Generator

**Date:** 2026-03-24
**Status:** Approved
**Context:** CanonForge — production reference image generation tool for filmmakers/writers

---

## Overview

SceneForge is a new fourth tab in CanonForge that generates a series of temporally-staged keyframe images for a scene. The output is a flipbook the user can preview to validate scene flow before taking keyframes into Google Flow for video generation.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `services/keyframeService.ts` | Builds temporal prompts, calls `/api/generate` once per frame |
| `components/SceneForgePanel.tsx` | Full tab UI — config, player, history |
| `components/FlipbookPlayer.tsx` | Standalone flipbook animation component |

### Modified Files

| File | Change |
|------|--------|
| `types.ts` | Add `Keyframe`, `KeyframeScene` types; add `'SceneForge'` to `AppTab` |
| `App.tsx` | Add SceneForge tab; add `keyframeScenes` state |
| `constants.ts` | Add tab label for SceneForge |

### No server changes required
Keyframe generation reuses the existing `/api/generate` endpoint with `fastRender: true`.

---

## Data Model

```ts
interface Keyframe {
  id: string;
  frameIndex: number;           // 0-based
  timestampSeconds: number;     // position in scene (e.g. 0, 8, 16, 24, 32)
  url: string;
  promptUsed: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

interface KeyframeScene {
  id: string;
  characterId: string;          // foreign key into CharacterProfile[] state
  setId: string;                // foreign key into SetProfile[] state
  characterName: string;        // denormalized for display only
  setName: string;              // denormalized for display only
  sceneAction: string;
  totalDuration: number;        // seconds
  intervalSeconds: number;      // 1–8, clamped in UI input and service guard
  mode: 'auto' | 'manual';
  manualBeats: string[];        // always present; length always equals frameCount
  frames: Keyframe[];
  createdAt: number;
}
```

Frame count is derived: `Math.floor(totalDuration / intervalSeconds) + 1`

**`manualBeats` sync rule:** `manualBeats` is always initialized to an array of `frameCount` empty strings and is kept in sync regardless of whether `mode` is `'auto'` or `'manual'`. When `totalDuration` or `intervalSeconds` changes and the new `frameCount` differs: truncate from the end if shorter, pad with empty strings if longer. This ensures that switching from auto to manual mode always produces a correctly-sized, non-stale beats array. Beats are never silently lost without user action.

---

## UI Layout — Stacked

```
┌─────────────────────────────────────────────────────────┐
│  Scene Config Bar (character, set, action, duration,    │
│  interval, auto/manual toggle, Forge button)            │
├─────────────────────────────────────────────────────────┤
│  Preview Window (active frame, enlarged)                │
│  [Frame 2 of 5 · 8s / 32s]                             │
├─────────────────────────────────────────────────────────┤
│  Filmstrip (scrollable row of thumbnails)               │
│  [▶] [speed slider]                                     │
├─────────────────────────────────────────────────────────┤
│  Scene History (past completed scenes)                  │
└─────────────────────────────────────────────────────────┘
```

---

## Prompt Generation

### Auto Mode
For N frames over a scene action, inject temporal stage descriptors:

- **Frame 1** → "Scene opening. [character description]. [action]: beginning. [set description]."
- **Middle frames** → "Scene midpoint at [Xs]. [character description]. [action]: in progress, [fraction] complete. [set description]."
- **Last frame** → "Scene end. [character description]. [action]: complete. [set description]."

Each prompt also includes the full character and set descriptions (same pattern as `generateCompositeImage`) to maintain identity lock via the character's seed.

### Manual Mode
User provides one beat description per frame (text fields appear dynamically based on frame count). Each beat replaces the temporal stage descriptor in the prompt — the rest (character, set, aesthetic core) remains the same.

### Shared parameters
- `fastRender: true` — for Gemini this requests 512px images; for Venice `fastRender` is currently ignored (Venice always uses the full VENICE_ASPECT_RATIO_MAP dimensions). Flipbook performance with Venice will be slower as a result — this is a known v1 limitation.
- `aspectRatio: '16:9'`
- `seed: char.seed` (character identity anchor, same as compositor; requires `characterId` to resolve the full `CharacterProfile` from state)
- `provider/model`: uses globally selected provider config
- `intervalSeconds` is clamped to 1–8 in both the UI input element and as a guard at the top of `generateKeyframeSequence`

---

## Flipbook Player

### Preview Window
- Displays the active frame enlarged (16:9 aspect ratio)
- Shows frame index and timestamp: "Frame 2 of 5 · 8s / 32s"

### Filmstrip
- Horizontal scrollable row of thumbnails
- Active frame has cyan border highlight
- Clicking a thumbnail sets the active frame
- Completed frames: show image thumbnail
- In-progress frames: show spinner
- Failed frames: red border + ↻ retry button on hover
- Completed frames: ↻ regenerate button on hover

### Controls
- Play / Pause button — **enabled as soon as the first frame reaches `done` status**, even while other frames are still pending or generating; disabled until then
- Speed slider: 1–8 fps
- Playback loops when it reaches the last frame; pending/error frames are displayed as their placeholder state during playback

---

## Generation Behavior

- All frames are dispatched **in parallel** immediately on "Forge Keyframes"
- Each frame updates its `status` independently as responses arrive
- Failed frames can be individually retried without regenerating the whole scene
- Generation uses the currently active global provider config (Gemini or Venice)

---

## Scene History

- A scene is appended to history when all frames have settled (all `status` is `done` or `error`) — partial completion is allowed in history
- Detection logic lives in a `useEffect` inside `SceneForgePanel` watching `activeScene.frames`: when every frame's status is `done` or `error` and the scene is not already in history, append it
- Each entry shows: character name · scene action · frame count · timestamp
- Clicking a history entry reloads it into the player
- History persists in component state (session-only, not localStorage — consistent with other tabs)

---

## Out of Scope (v1)

- Full-resolution export / ZIP download
- Multi-scene stacking / sequence stitching
- Google Flow direct integration
- Per-frame aspect ratio override
- Saving scenes to localStorage

---

## Success Criteria

1. All frames are dispatched concurrently on "Forge Keyframes" click — never sequentially
2. Playback begins (Play button activates) as soon as the first frame completes, even while others are still pending
3. Individual frame regeneration works without restarting the whole sequence
4. The tab integrates seamlessly with the existing provider/model selector
5. The `'SceneForge'` value is added to the `AppTab` union in `types.ts` AND to the tab array in `App.tsx`
