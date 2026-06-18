# PMQ Bingo

A bingo game for Prime Minister's Questions — tick off the clichés and dodges as they happen, live.

A bingo game for Prime Minister's Questions (PMQs). Spot common phrases and rhetorical devices used during PMQs and mark them off your bingo card.

## Features

- 5x5 bingo grid with randomised phrases from PMQs
- Win detection for rows, columns, diagonals, and full house
- Share your results with emoji grid
- Game state persists in localStorage
- House of Commons themed styling

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm start

# Run tests
npm test

# Build for production
npm run build
```

## Deployment

```bash
# Deploy to GitHub Pages
npm run deploy
```

## Versioning

Uses [standard-version](https://github.com/conventional-changelog/standard-version) for semantic versioning.

```bash
npm run release         # Bump version based on commits
npm run release:minor   # Force minor bump
npm run release:major   # Force major bump
```

## Scripts

### Phrase Generation

The phrase bank is generated from Hansard transcripts using LLM classification:

```bash
npm run extract-sentences    # Extract sentences from Hansard
npm run classify-gemini      # Classify using Gemini API
npm run generate-phrase-bank # Generate final phrase bank
```

## Tech Stack

- Angular 21
- TypeScript
- Vitest for testing
- GitHub Pages for hosting
