import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';

@Global()
@Module({
  imports: [
    NestCacheModule.register({
      ttl: 300000, // 5 mins
      max: 100, // 100 items at most
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule { }
