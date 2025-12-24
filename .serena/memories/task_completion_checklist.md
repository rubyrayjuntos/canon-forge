# Canon Forge - Task Completion Checklist

## Before Committing Code

### Type Safety
- [ ] No TypeScript errors (`npm run build` should succeed)
- [ ] New interfaces added to `types.ts`
- [ ] Updated `INITIAL_*_PROFILE` in `constants.ts` if adding profile fields

### Feature Additions
- [ ] New reference types added to BOTH union type AND template record
- [ ] Prompts include `AESTHETIC_PROMPT_CORE` prefix
- [ ] Seed is preserved for existing profiles (never randomize)

### UI Changes
- [ ] Uses Tailwind classes only (no CSS files)
- [ ] Follows color palette (slate/indigo)
- [ ] Responsive design considered

### Error Handling
- [ ] Generation functions have try/catch at call site
- [ ] User-friendly error messages via Toast

## No Automated Checks Yet
- No linting configured
- No formatting configured  
- No test suite

When these are added, run before committing:
```bash
npm run lint
npm run format
npm run test
```
