# Canon Face & Wardrobe — Character Generation Improvements

**Date:** 2026-03-25
**Status:** Approved
**Context:** CanonForge — production reference image generation tool for filmmakers/writers

---

## Overview

Two improvements to character generation that together address the primary source of visual inconsistency across generated images:

1. **Canon Face** — user supplies a reference photo of a face; a stylized canon headshot is generated and approved; that headshot is then sent as a visual reference input to every subsequent character generation (body shots, wardrobe, composites, keyframes).
2. **Wardrobe field** — a free-text signature outfit description added to `CharacterProfile` that is injected into every generation prompt, preventing the model from inventing different clothing each time.

---

## Data Model

### `CharacterProfile` — two new fields

```ts
interface CharacterProfile {
  // ... existing fields unchanged ...
  canonHeadshotUrl?: string;  // data URL of approved canon headshot; undefined until locked
  wardrobe: string;           // e.g. "weathered black leather jacket, cargo pants, neon collar"
}
```

- `canonHeadshotUrl` is optional. Characters without a locked face continue to work exactly as today.
- `wardrobe` defaults to `''`. When non-empty it is injected as `Signature Wardrobe: <value>.` into every generation prompt.
- `INITIAL_CHARACTER_PROFILE` in `constants.ts` adds `wardrobe: ''` (no `canonHeadshotUrl` — optional field, omitted from initial value).

---

## Feature 1: Canon Face

### Entry point — App.tsx wiring

The HEADSHOT button is rendered inside `ReferenceGallery` which calls `onGenerate={(t) => handleGen(t, 'CharacterForge')}`. To intercept it, `handleGen` gains an early-return branch:

```ts
const handleGen = async (type: string, forgeType: AppTab) => {
  if (type === 'HEADSHOT' && forgeType === 'CharacterForge') {
    setIsCanonDialogOpen(true);  // open dialog instead of generating
    return;
  }
  // ... existing handleGen logic unchanged ...
};
```

Two new App.tsx state variables:
```ts
const [isCanonDialogOpen, setIsCanonDialogOpen] = useState(false);
const [pendingNormalHeadshot, setPendingNormalHeadshot] = useState(false);
```

`CanonHeadshotDialog` is rendered at the root of the CharacterForge tab section (sibling to `ReferenceGallery`):
```tsx
<CanonHeadshotDialog
  isOpen={isCanonDialogOpen}
  profile={charProfile}
  fastRender={fastRender}
  providerConfig={providerConfig}
  onApprove={(url) => {
    setCharProfile({ ...charProfile, canonHeadshotUrl: url });
    setIsCanonDialogOpen(false);
  }}
  onSkip={() => {
    setIsCanonDialogOpen(false);
    setPendingNormalHeadshot(true);   // triggers normal headshot generation
  }}
/>
```

A `useEffect` in App.tsx fires normal headshot generation when `pendingNormalHeadshot` becomes true:
```ts
useEffect(() => {
  if (!pendingNormalHeadshot) return;
  setPendingNormalHeadshot(false);
  handleGen('HEADSHOT', 'CharacterForge');  // re-enters handleGen, dialog is closed so falls through
}, [pendingNormalHeadshot]);
```

### `CanonHeadshotDialog` props interface

```tsx
interface CanonHeadshotDialogProps {
  isOpen: boolean;
  profile: CharacterProfile;
  fastRender: boolean;
  providerConfig: ProviderConfig;
  onApprove: (canonUrl: string) => void;   // called with generated data URL on approval
  onSkip: () => void;                       // closes dialog, triggers normal headshot generation
}
```

### Dialog — three states

#### State 1: Upload
- File drop zone (click or drag-and-drop).
- **File validation**: on selection, check `file.type.startsWith('image/')`. If not an image, show an inline error: *"Please select an image file."* Do not advance past this state.
- **Size validation**: if `file.size > 10 * 1024 * 1024` (10 MB), show an inline error: *"Image is too large. Please use a file under 10 MB."* Do not advance.
- **Client-side downscale**: before encoding to base64, draw to a canvas and resize so the longest dimension is ≤ 1024px. This keeps the base64 payload under ~500 KB.
- Character name and brief profile summary shown for context.
- **Skip** button — calls `onSkip()`.
- On valid file selection: preview of uploaded image appears. **Generate Canon Headshot** button becomes enabled.

#### State 2: Generating
- Spinner: *"Creating your canon headshot…"* Reference photo remains visible.
- If the API call fails (network error, safety block, timeout): transition to **Error state** — show the error message, a **Try Again** button (returns to State 1 with the same file pre-loaded), and a **Skip** button.

#### State 3: Review
- Side-by-side: reference photo (left) | generated canon headshot (right).
- Three actions:
  - **✓ Approve as Canon Face** — calls `onApprove(generatedUrl)`.
  - **↻ Retry** — re-enters State 2 with the same reference image.
  - **Skip (use without locking)** — calls `onSkip()`.

### Canon headshot generation prompt

```
${AESTHETIC_PROMPT_CORE}
Subject: Character ${name}, ${age}y/o ${gender}, ${build} build, ${skinTone} skin, ${eyes} eyes, ${hair} hair. ${distinctiveFeatures}.
Scene: Extreme close-up cinematic headshot, neutral expression, microscopic skin texture and iris detail, neutral studio background, soft key lighting, character focus.
Style: High-fidelity cinematic photography. Strict facial and anatomical consistency. Maintain the exact facial features and identity from the reference image.
```

The reference photo is sent as an image part to Gemini **before** the text part:
```
contents: [{ parts: [{ inlineData: { mimeType, data: b64 } }, { text: prompt }] }]
```

### Venice limitation

When `providerConfig.provider === 'venice'`, the dialog displays: *"Reference image is not supported with Venice — canon headshot will be generated from description only."* The `referenceImage` field is omitted from the fetch body; generation proceeds text-only.

### Clearing the canon face

A small **× Clear canon face** link appears in CharacterForm when `canonHeadshotUrl` is set, alongside a thumbnail of the locked face. Clicking it sets `canonHeadshotUrl` to `undefined` on the profile (no other changes).

---

## Feature 2: Wardrobe Field

### CharacterForm

A new **Signature Wardrobe** text input added below the Distinctive Features field:

```
Label: Signature Wardrobe
Placeholder: e.g. weathered black leather jacket, cargo pants, neon circuit-trace collar
Name: wardrobe
```

Free-text, single line. Handled by the existing `handleChange` in `CharacterForm`.

### Prompt injection

When `profile.wardrobe` is non-empty, the following line is appended to the character identity block:

```
Signature Wardrobe: ${profile.wardrobe}.
```

Applied in:
- `generateCharacterImage` in `geminiService.ts` (all `ReferenceType` values)
- `generateCompositeImage` in `geminiService.ts`
- `buildKeyframePrompt` in `keyframeService.ts`

**`pollinationsService.ts`** (used for fast-render generations in App.tsx lines 391–399) is out of scope for v1. Wardrobe injection is not added there; fast-render generations will omit wardrobe when `fastRender` is true.

---

## Server Changes (`server/index.js`)

### JSON payload limit

Increase from `1mb` to `20mb` to accommodate base64-encoded reference images:
```js
app.use(express.json({ limit: '20mb' }));
```

### Reference image support

`/api/generate` accepts one new optional field: `referenceImage` (a data URL string).

**Gemini path** — when `referenceImage` is present:
```js
const parts = [];
if (referenceImage) {
  const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
  if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
}
parts.push({ text: prompt });
// contents: [{ parts }]
```

**Venice path** — `referenceImage` is ignored; generation proceeds text-only.

---

## Propagation — `canonHeadshotUrl` through all generation calls

### `geminiService.ts`

`callGemini` gains an optional `referenceImage?: string` parameter, forwarded in the POST body.

| Function | Source of reference |
|---|---|
| `generateCharacterImage(profile, type, fastRender)` | `profile.canonHeadshotUrl` |
| `generateCompositeImage(char, set, config, fastRender)` | `char.canonHeadshotUrl` |
| `generateSetImage` | none — not applicable |

### `keyframeService.ts`

`generateKeyframeSequence` gains `canonHeadshotUrl?: string` as a **5th parameter** (after `providerConfig`, before `onFrameUpdate`):

```ts
export async function generateKeyframeSequence(
  char: CharacterProfile,
  set: SetProfile,
  scene: KeyframeScene,
  providerConfig: ProviderConfig,
  canonHeadshotUrl: string | undefined,
  onFrameUpdate: (frameIndex: number, update: Partial<Keyframe>) => void
): Promise<void>
```

The fetch body includes `referenceImage: canonHeadshotUrl` (passes `undefined` when not set; server ignores falsy values).

`buildKeyframePrompt` gains `wardrobe: string` as an **8th parameter** (after `beat`):

```ts
export function buildKeyframePrompt(
  char: CharacterProfile,
  set: SetProfile,
  sceneAction: string,
  frameIndex: number,
  frameCount: number,
  timestampSeconds: number,
  beat: string,
  wardrobe: string
): string
```

When `wardrobe` is non-empty, appends `Signature Wardrobe: ${wardrobe}.` to the character identity block.

### `SceneForgePanel.tsx`

`handleForge` passes `char.canonHeadshotUrl` as the 5th argument to `generateKeyframeSequence` and `char.wardrobe` as the 8th argument to `buildKeyframePrompt`.

`handleRegenerate` — which calls `buildKeyframePrompt` directly (line 88) — passes `char.wardrobe` as the new 8th argument, and includes `referenceImage: char.canonHeadshotUrl` in its fetch body.

---

## Files Modified / Created

| File | Change |
|---|---|
| `types.ts` | Add `canonHeadshotUrl?: string` and `wardrobe: string` to `CharacterProfile` |
| `constants.ts` | Add `wardrobe: ''` to `INITIAL_CHARACTER_PROFILE` |
| `components/CharacterForm.tsx` | Add Wardrobe input field; add canon face thumbnail + clear link |
| `components/CanonHeadshotDialog.tsx` | **New** — three-state dialog with error state and file validation |
| `services/geminiService.ts` | Add `referenceImage` param to `callGemini`; propagate from `generateCharacterImage` and `generateCompositeImage`; inject `wardrobe` in prompts |
| `services/keyframeService.ts` | Add `canonHeadshotUrl` (5th param) to `generateKeyframeSequence`; add `wardrobe` (8th param) to `buildKeyframePrompt` |
| `components/SceneForgePanel.tsx` | Pass `char.canonHeadshotUrl` and `char.wardrobe` to `generateKeyframeSequence`, `buildKeyframePrompt`, and `handleRegenerate` fetch body |
| `server/index.js` | Increase JSON limit to `20mb`; accept and apply `referenceImage` in Gemini path |
| `App.tsx` | Add `isCanonDialogOpen` / `pendingNormalHeadshot` state; intercept HEADSHOT in `handleGen`; render `CanonHeadshotDialog` |

---

## Out of Scope (v1)

- Venice reference image support
- Multi-image reference sets (front + profile)
- Persisting canon face to localStorage
- Using the `BODY_REVERSE` body sheet as a full-body reference
- Wardrobe injection in `pollinationsService.ts` (fast-render path)
