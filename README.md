# Canon Forge — character-reference architect

Locked character, set, and shot contracts so image and video models render inside canon instead of reinventing the face and the room.

Identity is an approved headshot plus a prompt contract — not a paragraph the model is asked to remember. The model does not own state.

Case study: [SYSTEMS catalog — Canon Forge](https://rubyrayjuntos.github.io/rswan-portfolio/ParallaxThemes.html?project=canon-forge)

## What this is

A TypeScript / React 19 / Vite 6 studio with an Express generation proxy. Four forges share one production grammar:

| Forge | Owns |
| --- | --- |
| **CharacterForge** | `CharacterProfile` and approved stills (canon headshot is the identity kernel) |
| **SetForge** | Location, landmarks, forbidden changes, lighting-rig lock, canon wide/medium |
| **CompositorForge** | Bind character to set with action, shot type, angle, lens, distance, emotion |
| **SceneForge** | Keyframe sequences and a flipbook; compositor can also request an 8-second Veo clip |

Generations go through Express (`/api/generate`, `/api/generate-video`, `/api/generate-text`). Keys stay on the server. Client default image provider in source is **xAI** (Grok Imagine). Also wired: Gemini, Venice, Amazon Bedrock (Titan / SD), local Stable Diffusion. Video is Veo (`veo-3.0-fast-generate-001` by default), 8 seconds, 16:9.

Identity lock lives in `utils/identityLock.js` (unit-tested): prompt contracts plus optional attached stills when the provider accepts a reference or init image.

## What this is not

- Not InstantID, IP-Adapter, or a face-embedding model
- Not Temporal / Airflow / an orchestration product
- Not a hosted production SaaS (this repo is clone + keys)
- Not a finished editorial NLE — no lip-sync, no timeline
- Not the static portfolio HTML; Pages cannot keep provider keys

Profiles persist in `localStorage`. Optional AWS credential dialog exists for Bedrock. The `Dockerfile` in tree is a **dev** stage. `render.yaml` and a GHCR workflow exist; they are not proof of a live multi-tenant service.

## Stack

Identity Lock · Shot Contracts · Gemini · xAI · Veo · Express

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
cp .env.example .env.local
```

Set at least the key for the provider you will use (`XAI_API_KEY` for the client default, or `GEMINI_API_KEY`, `VENICE_API_KEY`, or AWS Bedrock vars). Then:

```bash
npm run dev
```

Vite serves the client; Express listens on port 3001 (`/api`). Production-shaped local run:

```bash
npm run build
npm start
```

```bash
npm test   # identityLock + provider helpers
npm run lint
```

## Source map

- Client: `App.tsx`, `components/`, `services/geminiService.ts`
- Identity lock: `utils/identityLock.js`
- Proxy: `server/index.js`, `server/xai.js`, `server/bedrockModels.js`
- CI: `.github/workflows/ci.yml` (lint + `vite build`)
