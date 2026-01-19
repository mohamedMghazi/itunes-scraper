import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PodcastsController } from './podcasts.controller';
import { PodcastsService } from './podcasts.service';
import { Podcast, PodcastSchema } from './schemas/podcast.schema';
import { Episode, EpisodeSchema } from './schemas/episode.schema';
import {
  SearchResult,
  SearchResultSchema,
} from './schemas/search-result.schema';
import { IpBlockGuard } from '../common/guards/ip-block.guard';
import { BotDetectionGuard } from '../common/guards/bot-detection.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Podcast.name, schema: PodcastSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: SearchResult.name, schema: SearchResultSchema },
    ]),
  ],
  controllers: [PodcastsController],
  providers: [PodcastsService, IpBlockGuard, BotDetectionGuard],
  exports: [PodcastsService],
})
export class PodcastsModule {}
