# Canon Forge - AI Coding Instructions

## Project Overview

Canon Forge is a React + TypeScript AI image generation app that creates consistent character and set reference images using Pollinations.ai. It ensures visual consistency across generated images through seed-based generation and structured prompts.

## Architecture

### Core Flow

1. **User creates profiles** → `CharacterProfile` or `SetProfile` with a unique `seed` number
2. **Profile saved** → localStorage via `utils/storage.ts` (keys: `saved_chars`, `saved_sets`)
3. **Generation requested** → `services/pollinationsService.ts` constructs prompts from templates
4. **Pollinations.ai returns** → Direct image URL displayed in gallery

### Key Files

- [types.ts](../types.ts) - All TypeScript interfaces (`CharacterProfile`, `SetProfile`, `ReferenceType`, etc.)
- [constants.ts](../constants.ts) - `AESTHETIC_PROMPT_CORE` and prompt templates that define the visual style
- [services/pollinationsService.ts](../services/pollinationsService.ts) - Pollinations.ai API integration (no auth needed)
- [App.tsx](../App.tsx) - Main state management, contains inline sub-components

## Critical Patterns

### Seed-Based Consistency

The `seed` field on profiles is critical for visual consistency:

```typescript
// Character's seed is the identity anchor - NEVER randomize for existing characters
return callPollinations(prompt, char.seed, '16:9');
```

When generating images, always use the profile's existing seed. Only call `generateSeed()` when creating NEW profiles.

### Prompt Construction

All prompts start with `AESTHETIC_PROMPT_CORE` and use templates from `constants.ts`:

```typescript
const prompt = `${AESTHETIC_PROMPT_CORE}
  Subject: Character ${profile.name}...
  Scene: ${CHARACTER_TEMPLATES[type]}`.trim();
```

When adding new reference types, add them to both the `ReferenceType` union AND the corresponding template record.

### Error Handling

Pollinations errors are simpler than other APIs:

- No API key required - no auth errors
- No content filtering - no safety blocks
- Network/timeout errors are the main failure mode
- All generation functions throw on failure; callers must handle with try/catch

## Code Conventions

### State Management

- All app state lives in `App.tsx` via `useState` hooks
- No external state library; props drill down to child components
- Toast notifications via `ToastState` pattern with `visible` boolean

### Component Structure

- Functional components with explicit `React.FC<Props>` typing
- Form components receive `profile` + `setProfile` callback pattern:

```typescript
interface CharacterFormProps {
  profile: CharacterProfile;
  setProfile: (profile: CharacterProfile) => void;
}
```

### Styling

- Tailwind CSS only - no CSS files
- Color palette: slate backgrounds, indigo accents, consistent with `AESTHETIC_PROMPT_CORE` style
- Common classes: `bg-slate-900`, `border-slate-800`, `text-indigo-400`

## Intended User Workflow

The three forges are designed to be used in sequence:

1. **CharacterForge** - Create and fine-tune character profiles, generate reference images
2. **SetForge** - Design environment/location profiles, generate set reference images
3. **CompositorForge** - Combine a saved character with a saved set to generate composite scenes

Users can work in any order, but the typical flow builds characters first, then sets, then composites.

## Development

### Run Locally

```bash
npm install
npm run dev  # Starts on port 3000
```

No API key required - Pollinations.ai is free and keyless.

### Environment

- Pollinations.ai requires no API key or environment variables
- Optional `window.aistudio` API for Google AI Studio integration (see `global.d.ts`) - legacy, not used

### Deployment

Target: AWS or Render (TBD). No deployment scripts configured yet.

### Testing

Testing infrastructure is not yet in place. When adding tests, follow React Testing Library patterns for component tests.

## Planned Features (Not Yet Implemented)

### Image Persistence & Folder Structure

Currently images are ephemeral (lost on page refresh). Planned architecture:

- **Folder structure**: Separate folders for `character/`, `set/`, `composite/`
- **File naming convention**: `{type}_{seed}_{uniqueId}.png` (e.g., `character_1234567_abc123.png`)
- **Auto-load**: When loading a saved profile, its associated images should also load

When implementing, consider:

- Images stored as base64 data URLs currently - will need file system or cloud storage
- Link images to profiles via the profile's `seed` value
- Update `utils/storage.ts` to handle image persistence alongside profile data

## Adding Features

### New Reference Type

1. Add to `ReferenceType` union in [types.ts](../types.ts)
2. Add template entry in [constants.ts](../constants.ts) (`CHARACTER_TEMPLATES` or `SET_TEMPLATES`)
3. Add generation button in `App.tsx` gallery section

### New Profile Field

1. Add to interface in [types.ts](../types.ts)
2. Add to `INITIAL_*_PROFILE` in [constants.ts](../constants.ts)
3. Add form input in corresponding form component
4. Update prompt construction in [pollinationsService.ts](../services/pollinationsService.ts)
