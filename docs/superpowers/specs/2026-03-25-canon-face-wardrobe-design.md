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

### Entry point

Clicking the **HEADSHOT** button in CharacterForge opens `CanonHeadshotDialog` instead of generating immediately. If the user skips, the dialog closes and the existing headshot generation runs normally (no behavior change for users who don't want to use a reference).

### CanonHeadshotDialog — three states

#### State 1: Upload
- File drop zone (click or drag-and-drop). Accepts image files only.
- Character name and profile summary shown so user has context.
- **Skip** button — closes dialog and triggers normal headshot generation.
- On file selection: preview of uploaded image appears. **Generate Canon Headshot** button becomes enabled.

#### State 2: Generating
- Spinner displayed. Reference photo remains visible.
- Calls `/api/generate` with the reference image and the canon headshot prompt (see below).

#### State 3: Review
- Side-by-side: reference photo (left) | generated canon headshot (right).
- Three actions:
  - **✓ Approve as Canon Face** — stores the generated URL as `canonHeadshotUrl` on the profile; dialog closes.
  - **↻ Retry** — regenerates with the same reference image (re-enters State 2).
  - **Skip (use without locking)** — discards the generated image; dialog closes without storing anything; triggers normal headshot generation.

### Canon headshot generation prompt

Same as the existing HEADSHOT template with one addition:

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

Venice is text-to-image only in the current integration. When the active provider is Venice and a reference image is provided, a note is displayed in the dialog: *"Reference image is not supported with Venice — canon headshot will be generated from description only."* Generation proceeds without the image part.

### Clearing the canon face

A small **× Clear canon face** link appears in the CharacterForm when `canonHeadshotUrl` is set. Clicking it sets `canonHeadshotUrl` to `undefined` (with no other profile changes). A thumbnail of the current canon face is shown next to the clear link so the user knows what is locked.

---

## Feature 2: Wardrobe Field

### CharacterForm

A new **Signature Wardrobe** text input added to CharacterForm, below the Distinctive Features field:

```
Label: Signature Wardrobe
Placeholder: e.g. weathered black leather jacket, cargo pants, neon circuit-trace collar
```

Free-text, single line. Empty by default.

### Prompt injection

When `profile.wardrobe` is non-empty, the following line is appended to the character identity block in every generation prompt:

```
Signature Wardrobe: ${profile.wardrobe}.
```

Applied in:
- `generateCharacterImage` (all `ReferenceType` values)
- `generateCompositeImage`
- `buildKeyframePrompt` in `keyframeService.ts`

---

## Server Changes (`server/index.js`)

`/api/generate` accepts one new optional field: `referenceImage` (a data URL string).

**Gemini path** — when `referenceImage` is present:
```js
const parts = [];
if (referenceImage && provider !== 'venice') {
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

All three public generation functions pass `profile.canonHeadshotUrl` (or `char.canonHeadshotUrl`) as `referenceImage`:

| Function | Source of reference |
|---|---|
| `generateCharacterImage(profile, type, fastRender)` | `profile.canonHeadshotUrl` |
| `generateCompositeImage(char, set, config, fastRender)` | `char.canonHeadshotUrl` |
| `generateSetImage` | none (set generation — not applicable) |

### `keyframeService.ts`

`generateKeyframeSequence` signature gains `canonHeadshotUrl?: string`. The fetch body includes `referenceImage: canonHeadshotUrl` when set.

`buildKeyframePrompt` gains `wardrobe: string` parameter and appends `Signature Wardrobe: ${wardrobe}.` when non-empty.

### `SceneForgePanel.tsx`

`handleForge` passes `char.canonHeadshotUrl` to `generateKeyframeSequence`.
`handleRegenerate` includes `referenceImage: char.canonHeadshotUrl` in its fetch body.

---

## Files Modified / Created

| File | Change |
|---|---|
| `types.ts` | Add `canonHeadshotUrl?: string` and `wardrobe: string` to `CharacterProfile` |
| `constants.ts` | Add `wardrobe: ''` to `INITIAL_CHARACTER_PROFILE` |
| `components/CharacterForm.tsx` | Add Wardrobe field; add canon face thumbnail + clear link |
| `components/CanonHeadshotDialog.tsx` | **New** — three-state dialog |
| `services/geminiService.ts` | Add `referenceImage` param to `callGemini`; propagate from all public functions |
| `services/keyframeService.ts` | Add `canonHeadshotUrl` to `generateKeyframeSequence`; add `wardrobe` to `buildKeyframePrompt` |
| `components/SceneForgePanel.tsx` | Pass `char.canonHeadshotUrl` and `char.wardrobe` through to generation calls |
| `server/index.js` | Accept and apply `referenceImage` in Gemini path |
| `App.tsx` | Wire `CanonHeadshotDialog` open/close state; pass `canonHeadshotUrl` on approve |

---

## Out of Scope (v1)

- Venice reference image support
- Multi-image reference sets (front + profile)
- Persisting canon face to localStorage
- Using the `BODY_REVERSE` body sheet as a full-body reference
