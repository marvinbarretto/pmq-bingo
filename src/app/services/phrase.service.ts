import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Phrase } from '../models/phrase.model';
import { TOTAL_CELLS } from '../models/game.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PhraseService {
  private readonly http = inject(HttpClient);
  private curatedPhrases: Phrase[] = [];
  private bankPhrases: Phrase[] = [];
  private loaded = false;

  async loadPhrases(): Promise<void> {
    if (this.loaded) return;

    const [curated, bank] = await Promise.all([
      firstValueFrom(this.http.get<Phrase[]>('data/curated-phrases.json')),
      firstValueFrom(this.http.get<Phrase[]>('data/phrase-bank.json')),
    ]);

    this.curatedPhrases = curated;
    this.bankPhrases = bank;
    this.loaded = true;
  }

  /**
   * Get phrases for a bingo card:
   * - All curated phrases are always included
   * - Remaining slots filled randomly from the phrase bank
   */
  getRandomPhrases(count: number = TOTAL_CELLS): Phrase[] {
    // Start with all curated phrases
    const selected = [...this.curatedPhrases];

    // Calculate how many random phrases we need
    const randomNeeded = count - selected.length;

    if (randomNeeded > 0) {
      // Filter out any bank phrases that match curated (by text)
      const curatedTexts = new Set(this.curatedPhrases.map(p => p.text.toLowerCase()));
      const availableBank = this.bankPhrases.filter(
        p => !curatedTexts.has(p.text.toLowerCase())
      );

      // Shuffle and pick random phrases from bank
      const shuffledBank = this.fisherYatesShuffle([...availableBank]);
      selected.push(...shuffledBank.slice(0, randomNeeded));
    }

    // Shuffle the final selection so curated aren't always at the top
    return this.fisherYatesShuffle(selected);
  }

  /**
   * Fisher-Yates (Knuth) shuffle — unbiased uniform random permutation.
   * Mutates and returns the array in place.
   */
  private fisherYatesShuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  getAllPhrases(): Phrase[] {
    return [...this.curatedPhrases, ...this.bankPhrases];
  }

  getCuratedPhrases(): Phrase[] {
    return this.curatedPhrases;
  }
}
