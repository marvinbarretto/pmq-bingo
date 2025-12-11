import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PhraseService } from '../../services/phrase.service';
import { HansardService } from '../../services/hansard';
import { Phrase } from '../../models/phrase.model';
import { HansardSearchResult } from '../../models/hansard.model';

type SearchMode = 'phrases' | 'hansard';

@Component({
  selector: 'app-phrase-browser',
  imports: [FormsModule, RouterLink],
  templateUrl: './phrase-browser.html',
  styleUrl: './phrase-browser.scss',
})
export class PhraseBrowser implements OnInit {
  private readonly phraseService = inject(PhraseService);
  private readonly hansardService = inject(HansardService);

  readonly searchQuery = signal('');
  readonly searchMode = signal<SearchMode>('phrases');
  readonly allPhrases = signal<Phrase[]>([]);
  readonly hansardResults = signal<HansardSearchResult[]>([]);
  readonly isLoading = signal(true);
  readonly isSearching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly totalHansardResults = signal(0);
  readonly currentPage = signal(1);

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
    this.hansardResults.set([]);
    this.searchError.set(null);
    this.currentPage.set(1);
  }

  setSearchMode(mode: SearchMode): void {
    this.searchMode.set(mode);
    this.hansardResults.set([]);
    this.searchError.set(null);
    this.currentPage.set(1);
  }

  searchHansard(): void {
    const query = this.searchQuery().trim();
    if (!query) return;

    this.isSearching.set(true);
    this.searchError.set(null);

    this.hansardService
      .searchHansard(query, {
        order: 'r',
        num: 20,
        page: this.currentPage(),
      })
      .subscribe({
        next: (response) => {
          this.hansardResults.set(response.rows || []);
          this.totalHansardResults.set(response.info?.total_results || response.rows?.length || 0);
          this.isSearching.set(false);
        },
        error: (error) => {
          console.error('Hansard search error:', error);
          this.searchError.set('Failed to search Hansard. Please try again.');
          this.isSearching.set(false);
        },
      });
  }

  loadNextPage(): void {
    this.currentPage.update(p => p + 1);
    this.searchHansard();
  }

  loadPrevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.searchHansard();
    }
  }

  stripHtml(html: string): string {
    return this.hansardService.stripHtml(html);
  }

  truncateText(text: string, maxLength: number = 300): string {
    const stripped = this.stripHtml(text);
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
  }
}
