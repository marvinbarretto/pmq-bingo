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
  private phrases: Phrase[] = [];
  private loaded = false;

  async loadPhrases(): Promise<void> {
    if (this.loaded) return;

    this.phrases = await firstValueFrom(
      this.http.get<Phrase[]>('data/phrase-bank.json')
    );
    this.loaded = true;
  }

  getRandomPhrases(count: number = TOTAL_CELLS): Phrase[] {
    const shuffled = [...this.phrases].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  getAllPhrases(): Phrase[] {
    return this.phrases;
  }
}
