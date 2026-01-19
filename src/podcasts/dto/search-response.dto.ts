export class PodcastDto {
  id: string;
  title: string;
  author: string;
  description: string;
  imageUrl: string;
  subscriberCount: string;
}

export class EpisodeDto {
  id: string;
  title: string;
  podcastTitle: string;
  publishedDate: string;
  duration: string;
  imageUrl: string;
}

export class SearchResponseDto {
  topResult?: PodcastDto;
  podcasts: PodcastDto[];
  episodes: EpisodeDto[];
  cached: boolean;
}
