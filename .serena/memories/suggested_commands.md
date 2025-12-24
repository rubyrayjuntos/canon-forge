# Canon Forge - Development Commands

## Setup
```bash
npm install
```

## Development
```bash
npm run dev    # Start dev server on port 3000
```

## Build
```bash
npm run build    # Production build
npm run preview  # Preview production build
```

## Environment
Create `.env.local` with:
```
GEMINI_API_KEY=your_api_key_here
```

## Git
```bash
git status
git add .
git commit -m "message"
git push origin main
```

## File Operations (Linux)
```bash
ls -la                    # List files
find . -name "*.ts"       # Find TypeScript files
grep -r "pattern" .       # Search in files
```

## Linting & Formatting
```bash
npm run lint        # Check for ESLint issues
npm run lint:fix    # Auto-fix ESLint issues
npm run format      # Format with Prettier
```

## No Testing Commands Yet