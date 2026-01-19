import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MongooseHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) { }

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // DB health
      () => this.db.pingCheck('database', { timeout: 5000 }),

      // Memory heap - alert if using more than 300MB
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // Memory RSS - alert if using more than 500MB
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

      // Storage - alert if more than 90% full
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get('liveness')
  @HealthCheck()
  liveness() {
    // Check if app is running
    return this.health.check([]);
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    // Check the db connectivity
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
    ]);
  }
}
