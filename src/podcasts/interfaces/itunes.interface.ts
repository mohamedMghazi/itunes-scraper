export interface ITunesResult {
  wrapperType?: string;
  kind?: string;
  collectionId?: number;
  trackId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  [key: string]: any;
}

export interface ITunesResponse {
  resultCount: number;
  results: ITunesResult[];
}
