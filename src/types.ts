export interface AdData {
  id: string;
  page_id: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  snapshot_url?: string;
  creative_bodies?: string[];
  fetched_at?: string;
  raw_data?: any;
  [key: string]: any;
}

export interface PageMetadata {
  page_id: string;
  last_synced: string;
  total_ads: number;
}

export interface GraphQLResponse {
  data?: {
    ad_library_main?: {
      search_results?: {
        edges?: Array<{
          node?: any;
        }>;
        page_info?: {
          has_next_page?: boolean;
        };
      };
    };
  };
}