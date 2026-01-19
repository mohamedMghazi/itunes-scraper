import {
  Controller,
  Get,
  Query,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { PodcastsService } from './podcasts.service';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { IpBlockGuard } from '../common/guards/ip-block.guard';
import { BotDetectionGuard } from '../common/guards/bot-detection.guard';

@Controller('api/podcasts')
@UseGuards(ThrottlerGuard, IpBlockGuard, BotDetectionGuard)
export class PodcastsController {
  constructor(private readonly podcastsService: PodcastsService) {}

  @Get('search')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests/minute
  async search(
    @Query(ValidationPipe) searchQuery: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    return this.podcastsService.search(searchQuery.query);
  }

  @Get('popular')
  @SkipThrottle()
  async getPopular(): Promise<{ queries: string[] }> {
    return this.podcastsService.getPopularSearches();
  }
}
