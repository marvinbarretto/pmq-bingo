import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  HansardSearchResult,
  HansardSearchResponse,
  HansardSearchOptions,
} from '../models/hansard.model';

@Injectable({
  providedIn: 'root',
})
export class HansardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://www.theyworkforyou.com/api';
  private readonly cache = new Map<string, Observable<HansardSearchResponse>>();

  searchHansard(
    term: string,
    options: HansardSearchOptions = {}
  ): Observable<HansardSearchResponse> {
    const cacheKey = this.getCacheKey(term, options);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const params: Record<string, string> = {
      key: environment.theyWorkForYouApiKey,
      search: term,
      output: 'js',
    };

    if (options.order) params['order'] = options.order;
    if (options.page) params['page'] = options.page.toString();
    if (options.num) params['num'] = options.num.toString();

    const request$ = this.http
      .get<HansardSearchResult[] | HansardSearchResponse>(
        `${this.baseUrl}/getHansard`,
        { params }
      )
      .pipe(
        map((response) => this.normalizeResponse(response)),
        shareReplay(1)
      );

    this.cache.set(cacheKey, request$);
    return request$;
  }

  private normalizeResponse(
    response: HansardSearchResult[] | HansardSearchResponse
  ): HansardSearchResponse {
    // API may return array directly or wrapped in object
    if (Array.isArray(response)) {
      return {
        rows: response,
        info: {
          page: 1,
          results_per_page: response.length,
          total_results: response.length,
        },
      };
    }
    return response;
  }

  private getCacheKey(term: string, options: HansardSearchOptions): string {
    return `${term}|${options.order || 'd'}|${options.page || 1}|${options.num || 20}`;
  }

  clearCache(): void {
    this.cache.clear();
  }

  stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
