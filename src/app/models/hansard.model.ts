export interface HansardSearchResult {
  gid: string;
  hdate: string;
  htime?: string;
  body: string;
  speaker?: {
    member_id: number;
    name: string;
    party: string;
    constituency?: string;
  };
  listurl?: string;
  parent?: {
    body: string;
  };
}

export interface HansardSearchResponse {
  rows: HansardSearchResult[];
  info: {
    page: number;
    results_per_page: number;
    total_results: number;
  };
}

export interface HansardSearchOptions {
  order?: 'd' | 'r' | 'p';  // date, relevance, person
  page?: number;
  num?: number;
}
