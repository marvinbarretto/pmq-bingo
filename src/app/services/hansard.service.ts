import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HansardSearchResult {
  rows: HansardEntry[];
  info: {
    total_results: number;
    results_per_page: number;
    page: number;
  };
}

export interface HansardEntry {
  gid: string;
  hdate: string;
  htime: string;
  section_id: string;
  subsection_id: string;
  htype: string;
  major: string;
  minor: string;
  person_id: string;
  speaker: {
    member_id: string;
    name: string;
    party: string;
    constituency: string;
  };
  body: string;
  listurl: string;
}

@Injectable({
  providedIn: 'root',
})
export class HansardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://www.theyworkforyou.com/api';
  private readonly apiKey = environment.theyWorkForYouApiKey;

  /**
   * Search Hansard debates for a specific phrase
   */
  searchDebates(
    query: string,
    options: {
      page?: number;
      num?: number;
      order?: 'd' | 'r' | 'p'; // date, relevance, person
    } = {}
  ): Observable<HansardSearchResult> {
    const params = new URLSearchParams({
      key: this.apiKey,
      search: query,
      output: 'js',
      page: String(options.page ?? 1),
      num: String(options.num ?? 100),
      order: options.order ?? 'd',
    });

    return this.http.get<HansardSearchResult>(
      `${this.baseUrl}/getHansard?${params}`
    );
  }

  /**
   * Get debates from a specific date range
   * Useful for fetching PMQ transcripts
   */
  getDebatesByDate(
    startDate: string,
    endDate: string,
    search?: string
  ): Observable<HansardSearchResult> {
    const params = new URLSearchParams({
      key: this.apiKey,
      output: 'js',
      num: '1000',
    });

    if (search) {
      params.set('search', search);
    }

    // TheyWorkForYou uses date format: YYYY-MM-DD
    // We'll search for PMQ-related content in the date range
    params.set('search', `${search || ''} section:PMQs`);

    return this.http.get<HansardSearchResult>(
      `${this.baseUrl}/getHansard?${params}`
    );
  }

  /**
   * Extract text content from HTML body
   */
  extractText(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }
}
