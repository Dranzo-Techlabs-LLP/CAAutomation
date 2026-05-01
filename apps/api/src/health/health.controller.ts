import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get()
  liveness(): { status: 'ok'; time: string } {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('ready')
  async readiness(): Promise<{ status: 'ok'; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query('SELECT 1 AS ok');
      checks.database = 'ok';
    } catch {
      checks.database = 'failed';
    }

    if (this.config.get<string>('DISABLE_SCHEDULER') === 'true') {
      checks.redis = 'disabled';
    } else {
      const redis = new Redis({
        host: this.config.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number(this.config.get<string>('REDIS_PORT') ?? 6379),
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

      try {
        await redis.connect();
        await redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'failed';
      } finally {
        redis.disconnect();
      }
    }

    const failed = Object.values(checks).some((status) => !['ok', 'disabled'].includes(status));
    if (failed) {
      throw new ServiceUnavailableException({ message: 'Service is not ready', checks });
    }

    return { status: 'ok', checks };
  }
}
