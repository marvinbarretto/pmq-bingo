import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PhraseService } from '../../services/phrase.service';
import { Phrase } from '../../models/phrase.model';

@Component({
  selector: 'app-phrase-browser',
  imports: [FormsModule, RouterLink],
  templateUrl: './phrase-browser.html',
  styleUrl: './phrase-browser.scss',
})
export class PhraseBrowser implements OnInit {
  private readonly phraseService = inject(PhraseService);

  readonly searchQuery = signal('');
  readonly allPhrases = signal<Phrase[]>([]);
  readonly isLoading = signal(true);

  readonly filteredPhrases = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const phrases = this.allPhrases();

    if (!query) {
      return phrases;
    }

    return phrases.filter(phrase =>
      phrase.text.toLowerCase().includes(query)
    );
  });

  readonly totalCount = computed(() => this.allPhrases().length);
  readonly filteredCount = computed(() => this.filteredPhrases().length);

  async ngOnInit(): Promise<void> {
    await this.phraseService.loadPhrases();
    this.allPhrases.set(this.phraseService.getAllPhrases());
    this.isLoading.set(false);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
