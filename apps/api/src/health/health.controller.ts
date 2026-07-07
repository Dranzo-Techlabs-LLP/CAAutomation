import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

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

    // Recurrences now run on an in-process timer (no Redis), so readiness only
    // depends on the database being reachable.
    const failed = Object.values(checks).some((status) => status !== 'ok');
    if (failed) {
      throw new ServiceUnavailableException({ message: 'Service is not ready', checks });
    }

    return { status: 'ok', checks };
  }
}
