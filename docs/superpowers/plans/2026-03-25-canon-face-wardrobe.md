# Canon Face & Wardrobe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a wardrobe field and a canon face lock to `CharacterProfile` so every generation uses the same clothing description and approved reference headshot.

**Architecture:** Two new `CharacterProfile` fields (`wardrobe: string`, `canonHeadshotUrl?: string`) flow through all generation paths. A new `CanonHeadshotDialog` intercepts the HEADSHOT button to let the user upload a reference photo and approve a stylized headshot; once approved, that data URL is sent as a Gemini image part to every subsequent generation. Wardrobe text is injected into all prompts (geminiService, keyframeService) when non-empty.

**Tech Stack:** React 19 + TypeScript, Express.js, `@google/genai` SDK, Gemini multimodal (image + text parts)

---

### Task 1: Types + Constants

**Files:**
- Modify: `types.ts`
- Modify: `constants.ts`

- [ ] **Step 1: Add fields to `CharacterProfile` in `types.ts`**

  Add two new fields after `undergarmentStyle`:

  ```ts
  export interface CharacterProfile {
    // ... existing fields unchanged ...
    undergarmentStyle: string;
    canonHeadshotUrl?: string;  // data URL of approved canon headshot; undefined until locked
    wardrobe: string;           // e.g. "weathered black leather jacket, cargo pants"
  }
  ```

- [ ] **Step 2: Add `wardrobe` default to `INITIAL_CHARACTER_PROFILE` in `constants.ts`**

  Add `wardrobe: ''` at the end of the object (no `canonHeadshotUrl` — optional field, omit from initial value):

  ```ts
  export const INITIAL_CHARACTER_PROFILE = {
    // ... existing fields unchanged ...
    undergarmentStyle: 'Matte black',
    wardrobe: '',
  };
  ```

- [ ] **Step 3: Verify TypeScript compiles clean**

  Run: `cd /home/rswan/Documents/canon-forge && npm run build 2>&1 | grep "error TS"`

  Expected: no output (zero TS errors). The `wardrobe: string` field is required but already satisfied by `INITIAL_CHARACTER_PROFILE`. All existing code that spreads `charProfile` will inherit the field. If errors appear, check that `INITIAL_CHARACTER_PROFILE` has `wardrobe: ''`.

- [ ] **Step 4: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add types.ts constants.ts
  git commit -m "feat: add canonHeadshotUrl and wardrobe fields to CharacterProfile"
  ```

---

### Task 2: Server — JSON limit + reference image

**Files:**
- Modify: `server/index.js:31` (JSON limit)
- Modify: `server/index.js:71-79` (request body destructuring)
- Modify: `server/index.js:134-142` (Gemini `contents` construction)

- [ ] **Step 1: Increase JSON body limit**

  Current line 31:
  ```js
  app.use(express.json({ limit: '1mb' }));
  ```
  Change to:
  ```js
  app.use(express.json({ limit: '20mb' }));
  ```

- [ ] **Step 2: Accept `referenceImage` in the `/api/generate` handler**

  Current line 72:
  ```js
  const { prompt, seed, aspectRatio, fastRender, provider = 'gemini', model } = req.body ?? {};
  ```
  Change to:
  ```js
  const { prompt, seed, aspectRatio, fastRender, provider = 'gemini', model, referenceImage } = req.body ?? {};
  ```

- [ ] **Step 3: Inject image part into Gemini `contents` when `referenceImage` is present**

  Current lines 134-142 (the `generate` arrow function):
  ```js
  const generate = (size) =>
    Promise.race([
      ai.models.generateContent({
        model: activeModel,
        contents: [{ parts: [{ text: prompt }] }],
        config: { seed: safeSeed, imageConfig: { aspectRatio: ratio, imageSize: size } },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)),
    ]);
  ```
  Replace with:
  ```js
  const parts = [];
  if (referenceImage) {
    const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
  }
  parts.push({ text: prompt });
  const generate = (size) =>
    Promise.race([
      ai.models.generateContent({
        model: activeModel,
        contents: [{ parts }],
        config: { seed: safeSeed, imageConfig: { aspectRatio: ratio, imageSize: size } },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), REQUEST_TIMEOUT_MS)),
    ]);
  ```
  Note: Venice path is unchanged — `referenceImage` is simply not read there.

- [ ] **Step 4: Verify server starts without error**

  Run: `cd /home/rswan/Documents/canon-forge && node server/index.js &` then `kill %1`

  Expected: no syntax errors in output.

- [ ] **Step 5: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add server/index.js
  git commit -m "feat: accept referenceImage in /api/generate and increase JSON limit to 20mb"
  ```

---

### Task 3: geminiService — wardrobe injection + canon reference

**Files:**
- Modify: `services/geminiService.ts`

The `callGemini` function needs an optional `referenceImage?: string` parameter forwarded in the POST body. `generateCharacterImage` and `generateCompositeImage` each need wardrobe injected into their prompts and `profile.canonHeadshotUrl` / `char.canonHeadshotUrl` passed as the reference.

- [ ] **Step 1: Add `referenceImage` to `callGemini`**

  Current signature (line 31–36):
  ```ts
  async function callGemini(
    prompt: string,
    seed: number,
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9",
    fastRender: boolean
  ): Promise<GenerationResult>
  ```
  New signature:
  ```ts
  async function callGemini(
    prompt: string,
    seed: number,
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9",
    fastRender: boolean,
    referenceImage?: string
  ): Promise<GenerationResult>
  ```

  In the `JSON.stringify` body, add `referenceImage` to the object:
  ```ts
  body: JSON.stringify({
    prompt, seed, aspectRatio, fastRender,
    provider: activeProviderConfig.provider,
    model: activeProviderConfig.model,
    referenceImage,
  }),
  ```

- [ ] **Step 2: Inject wardrobe and pass canon URL in `generateCharacterImage`**

  Current prompt ends with:
  ```ts
  Style: High-fidelity cinematic photography. Strict facial and anatomical consistency.`.trim();
  return callGemini(prompt, profile.seed, (type === 'BODY_REVERSE' || type === 'BODY_NUDE') ? "3:4" : "16:9", fastRender);
  ```

  Add wardrobe line to the prompt string, and pass `canonHeadshotUrl` to `callGemini`:
  ```ts
  const wardrobeLine = profile.wardrobe ? `Signature Wardrobe: ${profile.wardrobe}.` : '';
  const prompt = `${core}
      Subject: Character ${profile.name}, ${profile.age}y/o ${profile.gender}, ${profile.build} build, ${profile.skinTone} skin, ${profile.eyes} eyes, ${profile.hair} hair. ${profile.distinctiveFeatures}.
      ${wardrobeLine}
      Scene: ${CHARACTER_TEMPLATES[type]}
      ${undergarmentLine}
      Style: High-fidelity cinematic photography. Strict facial and anatomical consistency.`.trim();
  return callGemini(prompt, profile.seed, (type === 'BODY_REVERSE' || type === 'BODY_NUDE') ? "3:4" : "16:9", fastRender, profile.canonHeadshotUrl);
  ```

- [ ] **Step 3: Inject wardrobe and pass canon URL in `generateCompositeImage`**

  After the existing `const prompt = ...` construction, add the wardrobe line before the closing `Style:` line, and pass `char.canonHeadshotUrl` to `callGemini`:

  Add `const wardrobeLine = char.wardrobe ? \`Signature Wardrobe: ${char.wardrobe}.\` : '';` before the prompt template literal, then inject `${wardrobeLine}` after the `Note: The face must match...` line in the prompt. Change the final `callGemini` call:
  ```ts
  return callGemini(prompt, char.seed, "16:9", fastRender, char.canonHeadshotUrl);
  ```

- [ ] **Step 4: Verify TypeScript compiles clean**

  Run: `cd /home/rswan/Documents/canon-forge && npm run build 2>&1 | grep "error TS"`

  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add services/geminiService.ts
  git commit -m "feat: inject wardrobe into character/composite prompts, propagate canonHeadshotUrl to callGemini"
  ```

---

### Task 4: keyframeService — wardrobe + canon reference

**Files:**
- Modify: `services/keyframeService.ts`

`buildKeyframePrompt` needs an 8th `wardrobe: string` parameter. `generateKeyframeSequence` needs a 5th `canonHeadshotUrl?: string` parameter (inserted before `onFrameUpdate`).

- [ ] **Step 1: Add `wardrobe` param to `buildKeyframePrompt`**

  Current signature (7 params):
  ```ts
  export function buildKeyframePrompt(
    char: CharacterProfile,
    set: SetProfile,
    sceneAction: string,
    frameIndex: number,
    frameCount: number,
    timestampSeconds: number,
    beat: string
  ): string
  ```
  New signature (8 params):
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

  In the return template literal, add wardrobe injection after the `Character (MANDATORY IDENTITY)` line:
  ```ts
  return `${AESTHETIC_PROMPT_CORE}
      Scene Composition: Character in environment.
      Character (MANDATORY IDENTITY): ${char.name}, ${char.age}y/o ${char.gender}, ${char.build} build, ${char.skinTone} skin, ${char.eyes} eyes, ${char.hair} hair. ${char.distinctiveFeatures}.
      ${wardrobe ? `Signature Wardrobe: ${wardrobe}.` : ''}
      Environment: ${set.name}, ${set.locationType}, ${set.style} style, ${set.lighting} lighting. ${set.details}.
      Action: ${temporalStage}
      Style: High-fidelity cinematic photography. Keyframe ${frameIndex + 1} of ${frameCount}.`.trim();
  ```

- [ ] **Step 2: Add `canonHeadshotUrl` param to `generateKeyframeSequence` and forward it**

  Current signature (5 params):
  ```ts
  export async function generateKeyframeSequence(
    char: CharacterProfile,
    set: SetProfile,
    scene: KeyframeScene,
    providerConfig: ProviderConfig,
    onFrameUpdate: (frameIndex: number, update: Partial<Keyframe>) => void
  ): Promise<void>
  ```
  New signature (6 params — `canonHeadshotUrl` inserted as 5th):
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

  Update the `buildKeyframePrompt` call inside the function to pass `char.wardrobe` as 8th arg:
  ```ts
  const prompt = buildKeyframePrompt(char, set, scene.sceneAction, i, frameCount, timestampSeconds, beat, char.wardrobe);
  ```

  Add `referenceImage: canonHeadshotUrl` to the fetch body (server ignores `undefined`):
  ```ts
  body: JSON.stringify({
    prompt,
    seed: char.seed,
    aspectRatio: '16:9',
    fastRender: true,
    provider: providerConfig.provider,
    model: providerConfig.model,
    referenceImage: canonHeadshotUrl,
  }),
  ```

- [ ] **Step 3: Verify TypeScript compiles clean — expect errors at call sites**

  Run: `cd /home/rswan/Documents/canon-forge && npm run build 2>&1 | grep "error TS"`

  Expected: errors at `SceneForgePanel.tsx` call sites (`buildKeyframePrompt` called with 7 args, `generateKeyframeSequence` called with 5 args). These will be fixed in Task 7.

- [ ] **Step 4: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add services/keyframeService.ts
  git commit -m "feat: add wardrobe param to buildKeyframePrompt and canonHeadshotUrl param to generateKeyframeSequence"
  ```

---

### Task 5: CharacterForm — wardrobe input + canon face display

**Files:**
- Modify: `components/CharacterForm.tsx`

Add a Signature Wardrobe text input below the Distinctive Features field. Add a canon face thumbnail + clear link displayed at the top of the form when `canonHeadshotUrl` is set.

- [ ] **Step 1: Add Wardrobe input after the Distinctive Features field**

  The grid currently ends with the Distinctive Features input (lines ~81-83). After that closing `</div>`, before the closing `</div>` of the grid, add a new full-width row:

  ```tsx
  <div className="md:col-span-2">
    <label className={labelClass}>Signature Wardrobe</label>
    <input
      name="wardrobe"
      value={profile.wardrobe}
      onChange={handleChange}
      className={inputClass}
      placeholder="e.g. weathered black leather jacket, cargo pants, neon circuit-trace collar"
    />
  </div>
  ```

  `handleChange` already handles `setProfile({ ...profile, [name]: value })` — no changes needed there.

- [ ] **Step 2: Add canon face thumbnail + clear link**

  At the top of the returned JSX (inside `<div className="space-y-6">`), before the existing Gender Identity row, add a conditional block:

  ```tsx
  {profile.canonHeadshotUrl && (
    <div className="flex items-center gap-3 bg-slate-800/50 border border-indigo-500/30 rounded-lg px-3 py-2">
      <img
        src={profile.canonHeadshotUrl}
        alt="Canon face"
        className="w-10 h-10 rounded-full object-cover border border-indigo-500/50"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-indigo-400 font-mono uppercase tracking-wider">Canon Face Locked</p>
      </div>
      <button
        onClick={(e) => { e.preventDefault(); setProfile({ ...profile, canonHeadshotUrl: undefined }); }}
        className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
      >
        × Clear
      </button>
    </div>
  )}
  ```

- [ ] **Step 3: Verify TypeScript compiles clean**

  Run: `cd /home/rswan/Documents/canon-forge && npm run build 2>&1 | grep "error TS"`

  Expected: errors from Tasks 4 call-site changes in `SceneForgePanel.tsx` still present, but no new errors from this task.

- [ ] **Step 4: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add components/CharacterForm.tsx
  git commit -m "feat: add Signature Wardrobe input and canon face thumbnail/clear to CharacterForm"
  ```

---

### Task 6: CanonHeadshotDialog — new component

**Files:**
- Create: `components/CanonHeadshotDialog.tsx`

Four internal states: `'upload' | 'generating' | 'error' | 'review'`.

- [ ] **Step 1: Create the component file**

  Create `components/CanonHeadshotDialog.tsx` with the following structure:

  ```tsx
  import React, { useState, useRef } from 'react';
  import { CharacterProfile } from '../types';
  import { ProviderConfig } from '../services/geminiService';
  import { AESTHETIC_PROMPT_CORE } from '../constants';

  interface CanonHeadshotDialogProps {
    isOpen: boolean;
    profile: CharacterProfile;
    fastRender: boolean;
    providerConfig: ProviderConfig;
    onApprove: (canonUrl: string) => void;
    onSkip: () => void;
  }

  type DialogState = 'upload' | 'generating' | 'error' | 'review';

  function buildCanonPrompt(profile: CharacterProfile): string {
    return `${AESTHETIC_PROMPT_CORE}
  Subject: Character ${profile.name}, ${profile.age}y/o ${profile.gender}, ${profile.build} build, ${profile.skinTone} skin, ${profile.eyes} eyes, ${profile.hair} hair. ${profile.distinctiveFeatures}.
  Scene: Extreme close-up cinematic headshot, neutral expression, microscopic skin texture and iris detail, neutral studio background, soft key lighting, character focus.
  Style: High-fidelity cinematic photography. Strict facial and anatomical consistency. Maintain the exact facial features and identity from the reference image.`.trim();
  }

  async function downscaleImage(file: File): Promise<{ b64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({ b64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  const CanonHeadshotDialog: React.FC<CanonHeadshotDialogProps> = ({
    isOpen, profile, fastRender, providerConfig, onApprove, onSkip,
  }) => {
    const [state, setState] = useState<DialogState>('upload');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [fileError, setFileError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = (file: File) => {
      setFileError('');
      if (!file.type.startsWith('image/')) {
        setFileError('Please select an image file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setFileError('Image is too large. Please use a file under 10 MB.');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    };

    const handleGenerate = async () => {
      if (!selectedFile) return;
      setState('generating');
      try {
        const { b64, mimeType } = await downscaleImage(selectedFile);
        const prompt = buildCanonPrompt(profile);
        const body: Record<string, unknown> = {
          prompt,
          seed: profile.seed,
          aspectRatio: '1:1',
          fastRender,
          provider: providerConfig.provider,
          model: providerConfig.model,
        };
        if (providerConfig.provider !== 'venice') {
          body.referenceImage = `data:${mimeType};base64,${b64}`;
        }
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data?.error || 'Generation failed.');
        setGeneratedUrl(data.url);
        setState('review');
      } catch (err: any) {
        setErrorMessage(err.message || 'An error occurred. Please try again.');
        setState('error');
      }
    };

    const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-100">Canon Face Setup</h2>
            <button onClick={onSkip} className="text-slate-500 hover:text-slate-300 text-sm">Skip</button>
          </div>

          <p className="text-sm text-slate-400">
            <span className="text-indigo-400 font-semibold">{profile.name || 'Character'}</span>
            {profile.age ? `, ${profile.age}y/o` : ''}{profile.gender ? ` ${profile.gender}` : ''}.
            Upload a face photo to lock a canon headshot for all generations.
          </p>

          {/* Venice warning */}
          {providerConfig.provider === 'venice' && (
            <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-3 py-2">
              Reference image is not supported with Venice — canon headshot will be generated from description only.
            </p>
          )}

          {/* STATE: upload */}
          {state === 'upload' && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Reference" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="text-slate-500 space-y-2">
                    <i className="fas fa-cloud-upload-alt text-3xl"></i>
                    <p className="text-sm">Drop an image here or click to browse</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
              />
              {fileError && <p className="text-sm text-red-400">{fileError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedFile}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2 transition-colors"
                >
                  Generate Canon Headshot
                </button>
                <button
                  onClick={onSkip}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* STATE: generating */}
          {state === 'generating' && (
            <div className="space-y-4">
              {previewUrl && <img src={previewUrl} alt="Reference" className="max-h-40 mx-auto rounded-lg object-contain opacity-60" />}
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-400">Creating your canon headshot…</span>
              </div>
            </div>
          )}

          {/* STATE: error */}
          {state === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded px-3 py-2">{errorMessage}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setState('upload')}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onSkip}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* STATE: review */}
          {state === 'review' && generatedUrl && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider text-center">Reference</p>
                  <img src={previewUrl!} alt="Reference" className="w-full aspect-square object-cover rounded-lg" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-indigo-400 uppercase tracking-wider text-center">Canon Headshot</p>
                  <img src={generatedUrl} alt="Canon headshot" className="w-full aspect-square object-cover rounded-lg" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => onApprove(generatedUrl)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-4 py-2 transition-colors"
                >
                  ✓ Approve as Canon Face
                </button>
                <button
                  onClick={handleGenerate}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  ↻ Retry
                </button>
                <button
                  onClick={onSkip}
                  className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-1"
                >
                  Skip (use without locking)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  export default CanonHeadshotDialog;
  ```

- [ ] **Step 2: Verify TypeScript compiles clean (ignoring Task 4 call-site errors)**

  Run: `cd /home/rswan/Documents/canon-forge && npm run build 2>&1 | grep "error TS"`

  Expected: Only the pre-existing call-site errors from Task 4 (`SceneForgePanel.tsx`). No new errors from `CanonHeadshotDialog.tsx`.

- [ ] **Step 3: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add components/CanonHeadshotDialog.tsx
  git commit -m "feat: add CanonHeadshotDialog component with upload/generating/error/review states"
  ```

---

### Task 7: SceneForgePanel — forward wardrobe + canon reference

**Files:**
- Modify: `components/SceneForgePanel.tsx:88` (buildKeyframePrompt call in handleRegenerate)
- Modify: `components/SceneForgePanel.tsx:96-103` (fetch body in handleRegenerate)
- Modify: `components/SceneForgePanel.tsx:149` (generateKeyframeSequence call in handleForge)

- [ ] **Step 1: Update `buildKeyframePrompt` call in `handleRegenerate` (line 88)**

  Current:
  ```ts
  const prompt = buildKeyframePrompt(char, set, activeScene.sceneAction, frameIndex, frameCount, timestampSeconds, beat);
  ```
  New (add `char.wardrobe` as 8th arg):
  ```ts
  const prompt = buildKeyframePrompt(char, set, activeScene.sceneAction, frameIndex, frameCount, timestampSeconds, beat, char.wardrobe);
  ```

- [ ] **Step 2: Add `referenceImage` to `handleRegenerate` fetch body**

  Current fetch body (lines 96-103):
  ```ts
  body: JSON.stringify({
    prompt,
    seed: char.seed,
    aspectRatio: '16:9',
    fastRender: true,
    provider: providerConfig.provider,
    model: providerConfig.model,
  }),
  ```
  New:
  ```ts
  body: JSON.stringify({
    prompt,
    seed: char.seed,
    aspectRatio: '16:9',
    fastRender: true,
    provider: providerConfig.provider,
    model: providerConfig.model,
    referenceImage: char.canonHeadshotUrl,
  }),
  ```

- [ ] **Step 3: Update `generateKeyframeSequence` call in `handleForge` (line 149)**

  Current:
  ```ts
  await generateKeyframeSequence(char, set, newScene, providerConfig, handleFrameUpdate);
  ```
  New (add `char.canonHeadshotUrl` as 5th arg):
  ```ts
  await generateKeyframeSequence(char, set, newScene, providerConfig, char.canonHeadshotUrl, handleFrameUpdate);
  ```

- [ ] **Step 4: Verify TypeScript compiles clean — expect zero errors now**

  Run: `cd /home/rswan/Documents/canon-forge && npm run build 2>&1 | grep "error TS"`

  Expected: no output. Tasks 1–7 are all consistent now.

- [ ] **Step 5: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add components/SceneForgePanel.tsx
  git commit -m "feat: pass char.wardrobe and char.canonHeadshotUrl through SceneForgePanel generation calls"
  ```

---

### Task 8: App.tsx — intercept HEADSHOT + render CanonHeadshotDialog

**Files:**
- Modify: `App.tsx`

Add `isCanonDialogOpen` state, `skipDialogRef` ref, modify `handleGen` to intercept the HEADSHOT button, and render `CanonHeadshotDialog` in the CharacterForge section.

The `skipDialogRef` approach avoids the logic error in a simple `pendingNormalHeadshot` + `useEffect` pattern (where the useEffect would re-trigger the dialog). When Skip is pressed: set `skipDialogRef.current = true`, close the dialog, then call `handleGen('HEADSHOT', 'CharacterForge')` directly. Since `handleGen` checks the ref, it falls through to normal generation.

- [ ] **Step 1: Import `useRef` and `CanonHeadshotDialog` at the top of `App.tsx`**

  Current line 1:
  ```ts
  import React, { useState, useEffect, useCallback } from 'react';
  ```
  Change to:
  ```ts
  import React, { useState, useEffect, useCallback, useRef } from 'react';
  ```

  After the existing component imports (around line 34), add:
  ```ts
  import CanonHeadshotDialog from './components/CanonHeadshotDialog';
  ```

- [ ] **Step 2: Add `isCanonDialogOpen` state and `skipDialogRef` ref**

  Add near the other `useState` declarations (after `fastRender` state, around line 100–120 — find the block of state declarations):

  ```ts
  const [isCanonDialogOpen, setIsCanonDialogOpen] = useState(false);
  const skipDialogRef = useRef(false);
  ```

- [ ] **Step 3: Modify `handleGen` to intercept HEADSHOT**

  Current `handleGen` opens at line 385:
  ```ts
  const handleGen = async (type: string, forgeType: AppTab) => {
    setGenState({ isGenerating: true, statusMessage: `Forging ${type}...` });
  ```
  Add an early-return branch at the very top, before `setGenState`:
  ```ts
  const handleGen = async (type: string, forgeType: AppTab) => {
    if (type === 'HEADSHOT' && forgeType === 'CharacterForge' && !skipDialogRef.current) {
      setIsCanonDialogOpen(true);
      return;
    }
    skipDialogRef.current = false;  // reset after fall-through
    setGenState({ isGenerating: true, statusMessage: `Forging ${type}...` });
    // ... rest unchanged ...
  ```

- [ ] **Step 4: Render `CanonHeadshotDialog` in the CharacterForge section**

  In the CharacterForge tab JSX (around line 588–679), add `CanonHeadshotDialog` as a sibling to the `ReferenceGallery` div. Insert it just before the closing `</div>` of the outer grid (after line 679):

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
      skipDialogRef.current = true;
      handleGen('HEADSHOT', 'CharacterForge');
    }}
  />
  ```

- [ ] **Step 5: Verify TypeScript compiles clean with zero errors**

  Run: `cd /home/rswan/Documents/canon-forge && npm run build 2>&1 | grep "error TS"`

  Expected: no output.

- [ ] **Step 6: Smoke-test in browser**

  Start dev server: `npm run dev`

  Manual checks:
  1. Navigate to CharacterForge tab → click **Headshot** button → dialog opens
  2. Click **Skip** in dialog → dialog closes → normal headshot generates
  3. Open dialog again → drop or select an image file → **Generate Canon Headshot** button enables
  4. After generation → side-by-side review shows; click **✓ Approve as Canon Face**
  5. CharacterForm now shows the canon face thumbnail with "× Clear" link
  6. Generate another image type (e.g. WARDROBE) → verify build completes without error
  7. Click **× Clear** in CharacterForm → thumbnail disappears
  8. Navigate to SceneForge → forge a scene with the character → check browser network tab to confirm `referenceImage` field appears in `/api/generate` request body when canon URL is set

- [ ] **Step 7: Commit**

  ```bash
  cd /home/rswan/Documents/canon-forge
  git add App.tsx
  git commit -m "feat: intercept HEADSHOT button to open CanonHeadshotDialog, wire approve/skip flow"
  ```

---

## Post-Implementation

After all 8 tasks:

1. Run final build check: `npm run build 2>&1 | grep "error TS"` → zero errors
2. Use `superpowers:finishing-a-development-branch` to merge or create PR
