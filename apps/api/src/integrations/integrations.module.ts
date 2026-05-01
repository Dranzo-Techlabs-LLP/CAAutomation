import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './api-key.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { Webhook } from './webhook.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, Webhook])],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService, TypeOrmModule],
})
export class IntegrationsModule {}
