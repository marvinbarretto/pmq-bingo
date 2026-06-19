import '@angular/compiler'; // required for JIT compilation in Vitest environment
import { describe, it, expect, beforeEach } from 'vitest';
import { PhraseService } from './phrase.service';
import { Phrase } from '../models/phrase.model';
import { TOTAL_CELLS } from '../models/game.model';

// Build a test instance without Angular DI / HTTP
function makeService(curatedPhrases: Phrase[], bankPhrases: Phrase[]): PhraseService {
  const svc = Object.create(PhraseService.prototype) as PhraseService;
  // Bypass private property access via type casting
  (svc as any).curatedPhrases = curatedPhrases;
  (svc as any).bankPhrases = bankPhrases;
  (svc as any).loaded = true;
  return svc;
}

function makePhrases(prefix: string, count: number): Phrase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    text: `${prefix} phrase ${i + 1}`,
  }));
}

// Realistic-size phrase bank mirroring the actual data (10 curated + 53 bank)
const CURATED_COUNT = 10;
const BANK_COUNT = 53;
const curatedPhrases = makePhrases('c', CURATED_COUNT);
const bankPhrases = makePhrases('b', BANK_COUNT);

describe('PhraseService — getRandomPhrases()', () => {
  let service: PhraseService;

  beforeEach(() => {
    service = makeService(curatedPhrases, bankPhrases);
  });

  it('returns exactly 25 phrases (TOTAL_CELLS)', () => {
    const result = service.getRandomPhrases();
    expect(result).toHaveLength(TOTAL_CELLS);
  });

  it('returns the requested count when overridden', () => {
    const result = service.getRandomPhrases(10);
    expect(result).toHaveLength(10);
  });

  it('returns no duplicate phrases (by id)', () => {
    const result = service.getRandomPhrases();
    const ids = result.map(p => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(result.length);
  });

  it('returns no duplicate phrases (by text)', () => {
    const result = service.getRandomPhrases();
    const texts = result.map(p => p.text.toLowerCase());
    const unique = new Set(texts);
    expect(unique.size).toBe(result.length);
  });

  it('always includes all curated phrases', () => {
    // Run several times to confirm curated are always present
    for (let i = 0; i < 20; i++) {
      const result = service.getRandomPhrases();
      const resultIds = new Set(result.map(p => p.id));
      for (const cp of curatedPhrases) {
        expect(resultIds.has(cp.id), `curated phrase ${cp.id} missing from board`).toBe(true);
      }
    }
  });

  it('produces different orderings across multiple calls (not always the same sequence)', () => {
    const runs = Array.from({ length: 20 }, () =>
      service.getRandomPhrases().map(p => p.id).join(',')
    );
    const unique = new Set(runs);
    // With 25! possible permutations, the chance of 20 identical results is astronomically small
    expect(unique.size).toBeGreaterThan(1);
  });

  it('all bank phrases can appear in generated boards (uniform coverage over 1000 boards)', () => {
    const RUNS = 1000;
    const seen = new Set<string>();

    for (let i = 0; i < RUNS; i++) {
      const result = service.getRandomPhrases();
      for (const p of result) {
        seen.add(p.id);
      }
    }

    // Every bank phrase should appear at least once across 1000 boards
    for (const bp of bankPhrases) {
      expect(seen.has(bp.id), `bank phrase ${bp.id} never appeared in ${RUNS} boards`).toBe(true);
    }

    // Every curated phrase should appear in every board (hence all 1000)
    for (const cp of curatedPhrases) {
      expect(seen.has(cp.id), `curated phrase ${cp.id} never appeared`).toBe(true);
    }
  });

  it('bank phrase frequency is roughly uniform across 1000 boards (chi-square)', () => {
    const RUNS = 1000;
    const freq: Record<string, number> = {};

    for (const bp of bankPhrases) freq[bp.id] = 0;

    for (let i = 0; i < RUNS; i++) {
      const result = service.getRandomPhrases();
      for (const p of result) {
        if (p.id in freq) freq[p.id]++;
      }
    }

    // Each board picks (TOTAL_CELLS - CURATED_COUNT) = 15 bank phrases out of BANK_COUNT = 53
    // Expected appearances per phrase ≈ RUNS * 15 / 53 ≈ 283
    const expected = (RUNS * (TOTAL_CELLS - CURATED_COUNT)) / BANK_COUNT;

    // Chi-square statistic
    const chiSquare = Object.values(freq).reduce((acc, observed) => {
      const diff = observed - expected;
      return acc + (diff * diff) / expected;
    }, 0);

    // Degrees of freedom = BANK_COUNT - 1 = 52
    // Critical value for p=0.001 with df=52 is approximately 86.
    // A badly biased sort() shuffle produces chi-square values in the thousands.
    // Fisher-Yates should comfortably stay below 86 with 1000 runs.
    expect(chiSquare).toBeLessThan(86);
  });
});
