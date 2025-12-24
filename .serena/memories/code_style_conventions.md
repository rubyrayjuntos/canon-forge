# Canon Forge - Code Style & Conventions

## TypeScript
- Strict typing with explicit interfaces in `types.ts`
- Use `React.FC<Props>` for functional components
- Union types for enums: `type ReferenceType = 'HEADSHOT' | 'BODY_REVERSE' | ...`

## React Patterns
- Functional components only (no class components except ErrorBoundary)
- useState for all state management
- Props drilling pattern: `profile` + `setProfile` callback
- Custom hooks in `hooks/` directory (e.g., `useClipboard`)

## Component Structure
```typescript
interface ComponentProps {
  profile: ProfileType;
  setProfile: (profile: ProfileType) => void;
}

const Component: React.FC<ComponentProps> = ({ profile, setProfile }) => {
  // ...
};

export default Component;
```

## Styling (Tailwind)
- No CSS files - Tailwind utility classes only
- Color palette: slate backgrounds, indigo accents
- Common classes: `bg-slate-900`, `border-slate-800`, `text-indigo-400`
- Responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

## Error Handling
- Gemini errors throw specific messages: `"AUTH_REQUIRED"`, `"SAFETY"`
- Callers wrap in try/catch
- Toast notifications for user feedback

## File Organization
- Types in `types.ts` at root
- Constants/templates in `constants.ts`
- Services in `services/` directory
- Utilities in `utils/` directory
- React hooks in `hooks/` directory
- Components in `components/` directory
