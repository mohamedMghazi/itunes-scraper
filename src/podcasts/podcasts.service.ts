import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Podcast } from './schemas/podcast.schema';
import { Episode } from './schemas/episode.schema';
import { SearchResult } from './schemas/search-result.schema';
import { ITunesResponse, ITunesResult } from './interfaces/itunes.interface';
import {
  SearchResponseDto,
  PodcastDto,
  EpisodeDto,
} from './dto/search-response.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class PodcastsService {
  private readonly logger = new StructuredLoggerService(PodcastsService.name);
  private readonly itunesApiUrl: string;
  private readonly PODCAST_CACHE_TTL = 12 * 60 * 60; // 12 hours
  private readonly EPISODE_CACHE_TTL = 6 * 60 * 60; // 6 hours
  private readonly MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectModel(Podcast.name) private readonly podcastModel: Model<Podcast>,
    @InjectModel(Episode.name) private readonly episodeModel: Model<Episode>,
    @InjectModel(SearchResult.name)
    private readonly searchResultModel: Model<SearchResult>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.itunesApiUrl = this.configService.get<string>('itunes.apiUrl');
  }

  async search(query: string): Promise<SearchResponseDto> {
    const startTime = Date.now();
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      throw new HttpException('Query cannot be empty', HttpStatus.BAD_REQUEST);
    }

    // Check in-memory cache firstly
    const memCacheKey = `search:${normalizedQuery}`;
    const memCached =
      await this.cacheManager.get<SearchResponseDto>(memCacheKey);
    if (memCached) {
      this.logger.logCacheHit('memory', normalizedQuery, {
        responseTime: Date.now() - startTime,
      });
      return { ...memCached, cached: true };
    }

    // Check database cache
    const dbCached = await this.getCachedSearch(normalizedQuery);
    if (dbCached) {
      this.logger.logCacheHit('database', normalizedQuery, {
        responseTime: Date.now() - startTime,
      });
      // Store in memory cache for next request
      await this.cacheManager.set(memCacheKey, dbCached, this.MEMORY_CACHE_TTL);
      return { ...dbCached, cached: true };
    }

    this.logger.logCacheMiss(normalizedQuery);

    // Fetch from iTunes
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second

    try {
      const [podcastResults, episodeResults] = await Promise.all([
        this.fetchFromItunes(query, 'podcast', 18, controller.signal),
        this.fetchFromItunes(query, 'podcastEpisode', 18, controller.signal),
      ]);

      clearTimeout(timeout);

      // Build the flash response
      const response = this.buildResponse(
        podcastResults,
        episodeResults,
        false,
      );

      // Save to database in background while returning the response.
      this.saveResults(podcastResults, episodeResults)
        .then(({ podcasts, episodes }) => {
          return this.cacheSearchResults(normalizedQuery, podcasts, episodes);
        })
        .catch((err: Error) =>
          this.logger.error('Background save failed', err.stack, {
            error: err.message,
            query: normalizedQuery,
          }),
        );

      // Cache in memory
      await this.cacheManager.set(memCacheKey, response, this.MEMORY_CACHE_TTL);

      this.logger.logPerformanceMetric(
        'search_response_time',
        Date.now() - startTime,
        'ms',
        { query: normalizedQuery, cached: false },
      );

      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpException('Request timeout', HttpStatus.REQUEST_TIMEOUT);
      }
      throw error;
    }
  }

  private async fetchFromItunes(
    query: string,
    entity: 'podcast' | 'podcastEpisode',
    limit: number,
    signal?: AbortSignal,
  ): Promise<ITunesResult[]> {
    if (!query.trim()) {
      return [];
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `${this.itunesApiUrl}/search?term=${encodedQuery}&media=podcast&entity=${entity}&limit=${limit}`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, { signal });
      const duration = Date.now() - startTime;

      if (!response.ok) {
        this.logger.logExternalApiCall('iTunes', url, duration, false, {
          statusCode: response.status,
          statusText: response.statusText,
        });
        throw new HttpException(
          `iTunes API error: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = (await response.json()) as ITunesResponse;
      this.logger.logExternalApiCall('iTunes', url, duration, true, {
        resultCount: data.results?.length || 0,
        entity,
      });
      return data.results || [];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('iTunes API request timeout', {
          query,
          entity,
          duration: Date.now() - startTime,
        });
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'iTunes API fetch failed',
        error instanceof Error ? error.stack : undefined,
        {
          error: errorMessage,
          query,
          entity,
        },
      );
      throw new HttpException(
        'Failed to fetch from iTunes API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private buildResponse(
    podcastResults: ITunesResult[],
    episodeResults: ITunesResult[],
    cached: boolean,
  ): SearchResponseDto {
    const podcasts = podcastResults.map(this.transformPodcast);
    const episodes = episodeResults.map(this.transformEpisode);

    return {
      topResult: podcasts[0],
      podcasts,
      episodes,
      cached,
    };
  }

  private readonly transformPodcast = (item: ITunesResult): PodcastDto => {
    return {
      id: String(item.collectionId),
      title: item.collectionName || item.artistName || 'Untitled',
      author: item.artistName || 'Unknown Artist',
      description: '',
      imageUrl: item.artworkUrl600 || item.artworkUrl100 || '',
      subscriberCount: 'Unknown',
    };
  };

  private readonly transformEpisode = (item: ITunesResult): EpisodeDto => {
    return {
      id: String(item.trackId),
      title: item.trackName || 'Untitled Episode',
      podcastTitle: item.collectionName || item.artistName || 'Unknown Podcast',
      publishedDate: this.formatDate(item.releaseDate),
      duration: this.formatDuration(item.trackTimeMillis),
      imageUrl: item.artworkUrl600 || item.artworkUrl100 || '',
    };
  };

  private async saveResults(
    podcastResults: ITunesResult[],
    episodeResults: ITunesResult[],
  ): Promise<{ podcasts: Podcast[]; episodes: Episode[] }> {
    const podcastOps = podcastResults.map((item) => ({
      updateOne: {
        filter: { collectionId: String(item.collectionId) },
        update: {
          $set: {
            collectionId: String(item.collectionId),
            title: item.collectionName || item.artistName || 'Untitled',
            author: item.artistName || 'Unknown Artist',
            description: '',
            imageUrl: item.artworkUrl600 || item.artworkUrl100 || '',
            subscriberCount: 'Unknown',
            rawData: item,
          },
        },
        upsert: true,
      },
    }));

    const episodeOps = episodeResults.map((item) => ({
      updateOne: {
        filter: { trackId: String(item.trackId) },
        update: {
          $set: {
            trackId: String(item.trackId),
            title: item.trackName || 'Untitled Episode',
            podcastTitle:
              item.collectionName || item.artistName || 'Unknown Podcast',
            publishedDate: this.formatDate(item.releaseDate),
            duration: this.formatDuration(item.trackTimeMillis),
            imageUrl: item.artworkUrl600 || item.artworkUrl100 || '',
            rawData: item,
          },
        },
        upsert: true,
      },
    }));

    await Promise.all([
      podcastOps.length > 0
        ? this.podcastModel.bulkWrite(podcastOps)
        : Promise.resolve(),
      episodeOps.length > 0
        ? this.episodeModel.bulkWrite(episodeOps)
        : Promise.resolve(),
    ]);

    // Fetch the saved documents
    const [podcasts, episodes] = await Promise.all([
      this.podcastModel.find({
        collectionId: {
          $in: podcastResults.map((p) => String(p.collectionId)),
        },
      }),
      this.episodeModel.find({
        trackId: { $in: episodeResults.map((e) => String(e.trackId)) },
      }),
    ]);

    return { podcasts, episodes };
  }

  private async getCachedSearch(
    query: string,
  ): Promise<SearchResponseDto | null> {
    const cached = await this.searchResultModel
      .findOne({ query, expiresAt: { $gt: new Date() } })
      .lean();

    if (!cached) {
      return null;
    }

    // Fetch in parallel with projection to reduce data transfer
    const [podcasts, episodes] = await Promise.all([
      this.podcastModel
        .find({ collectionId: { $in: cached.podcastIds } })
        .select('-rawData -__v')
        .lean(),
      this.episodeModel
        .find({ trackId: { $in: cached.episodeIds } })
        .select('-rawData -__v')
        .lean(),
    ]);

    const podcastDtos = podcasts.map((p) => this.toPodcastDto(p));
    const episodeDtos = episodes.map((e) => this.toEpisodeDto(e));

    return {
      topResult: podcastDtos[0],
      podcasts: podcastDtos,
      episodes: episodeDtos,
      cached: true,
    };
  }

  private async cacheSearchResults(
    query: string,
    podcasts: Podcast[],
    episodes: Episode[],
  ): Promise<void> {
    // Use shorter TTL (6h for episodes) since episodes are more dynamic
    const ttlSeconds = Math.min(this.PODCAST_CACHE_TTL, this.EPISODE_CACHE_TTL);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.searchResultModel.findOneAndUpdate(
      { query },
      {
        query,
        podcastIds: podcasts.map((p) => p.collectionId),
        episodeIds: episodes.map((e) => e.trackId),
        expiresAt,
      },
      { upsert: true, new: true },
    );
  }

  async getPopularSearches(limit: number = 10): Promise<{ queries: string[] }> {
    const popular = await this.searchResultModel
      .aggregate<{ _id: string; count: number; lastSearched: Date }>([
        {
          $group: {
            _id: '$query',
            count: { $sum: 1 },
            lastSearched: { $max: '$createdAt' },
          },
        },
        { $sort: { count: -1, lastSearched: -1 } },
        { $limit: limit },
      ])
      .exec();

    return {
      queries: popular.map((item) => item._id),
    };
  }

  private formatDuration(millis?: number): string {
    if (!millis) return '';
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatDate(dateString?: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private toPodcastDto(podcast: Podcast): PodcastDto {
    return {
      id: podcast.collectionId,
      title: podcast.title,
      author: podcast.author,
      description: podcast.description,
      imageUrl: podcast.imageUrl,
      subscriberCount: podcast.subscriberCount,
    };
  }

  private toEpisodeDto(episode: Episode): EpisodeDto {
    return {
      id: episode.trackId,
      title: episode.title,
      podcastTitle: episode.podcastTitle,
      publishedDate: episode.publishedDate,
      duration: episode.duration,
      imageUrl: episode.imageUrl,
    };
  }
}
