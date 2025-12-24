# Canon Forge - Project Overview

## Purpose
Canon Forge is a React + TypeScript AI image generation application for creating consistent character and set reference images using Google's Gemini API. It ensures visual consistency across generated images through seed-based generation and structured prompts.

## Tech Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (utility classes only, no CSS files)
- **AI Integration**: Pollinations.ai (no API key needed, permissive content policy)
- **State Management**: React useState hooks (no external state library)
- **Storage**: localStorage for profile persistence

## Core Concepts

### Three Forges (Tabs)
1. **CharacterForge** - Create/fine-tune character profiles, generate reference images
2. **SetForge** - Design environment/location profiles, generate set reference images
3. **CompositorForge** - Combine saved character + set to generate composite scenes

### Seed-Based Consistency
Each profile has a unique `seed` number that ensures visual consistency:
- Same seed = same visual identity across all generated images
- Only generate new seeds for NEW profiles, never for existing ones
- Character seed is the "identity anchor" in composite generation

### Prompt Architecture
- All prompts start with `AESTHETIC_PROMPT_CORE` from `constants.ts`
- Templates in `CHARACTER_TEMPLATES` and `SET_TEMPLATES` define shot types
- Prompt construction happens in `services/geminiService.ts`

## Key Files
- `types.ts` - All TypeScript interfaces
- `constants.ts` - Prompts, templates, initial profile defaults
- `services/geminiService.ts` - Gemini API integration
- `App.tsx` - Main app state and inline sub-components
- `utils/storage.ts` - localStorage helpers
- `components/` - Reusable UI components

## Current Limitations (Planned Features)
- Images are ephemeral (lost on refresh) - need file/cloud storage
- No testing infrastructure yet
- Deployment target TBD (AWS or Render)
