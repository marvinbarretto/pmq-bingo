# PMQ Bingo

Angular 21 bingo game for Prime Minister's Questions.

## Project Structure

- `src/app/components/` - Angular components (game-page, bingo-card, bingo-cell, game-controls, win-modal)
- `src/app/services/` - GameService (state management), PhraseService (phrase bank)
- `src/app/models/` - TypeScript interfaces
- `scripts/` - Node scripts for phrase generation from Hansard API

## Key Commands

```bash
npm start           # Dev server
npm test            # Vitest tests
npm run deploy      # Build and deploy to GitHub Pages
npm run release     # Bump version with standard-version
```

## Path Aliases

- `@/*` maps to project root (e.g., `@/package.json`)

## Conventions

- Use Angular signals for state management
- SCSS: don't use `darken()` or `lighten()` - deprecated
- CSS variables defined in `src/styles/` (House of Commons theme)
- Vitest for unit tests (not Karma/Jasmine)