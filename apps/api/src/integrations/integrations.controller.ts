import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { ApiKey } from './api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { IntegrationsService } from './integrations.service';
import { Webhook } from './webhook.entity';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('api-keys')
  @Permissions('api_key.create')
  async createApiKey(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    return this.integrationsService.createApiKey(user.firmId, dto, user.id);
  }

  @Get('webhooks')
  @Permissions('webhook.view')
  async listWebhooks(@CurrentUser() user: RequestUser): Promise<Webhook[]> {
    return this.integrationsService.listWebhooks(user.firmId);
  }

  @Post('webhooks')
  @Permissions('webhook.create')
  async createWebhook(@CurrentUser() user: RequestUser, @Body() dto: CreateWebhookDto): Promise<Webhook> {
    return this.integrationsService.createWebhook(user.firmId, dto);
  }
}
