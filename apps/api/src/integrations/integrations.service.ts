import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ApiKey } from './api-key.entity';
import { Webhook } from './webhook.entity';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
  ) {}

  async createApiKey(firmId: string, dto: CreateApiKeyDto, actorUserId: string): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey = `tbm_${randomBytes(32).toString('hex')}`;
    const apiKey = await this.apiKeyRepository.save(
      this.apiKeyRepository.create({
        firmId,
        name: dto.name,
        keyHash: this.hash(rawKey),
        scopesJson: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdByUserId: actorUserId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
    return { apiKey, rawKey };
  }

  async validateRawKey(rawKey: string, requiredScope: string): Promise<ApiKey> {
    const key = await this.apiKeyRepository.findOne({
      where: [
        { keyHash: this.hash(rawKey), isActive: true, expiresAt: MoreThan(new Date()) },
        { keyHash: this.hash(rawKey), isActive: true, expiresAt: null },
      ],
    });
    if (!key || (!key.scopesJson.includes(requiredScope) && !key.scopesJson.includes('full-access'))) {
      throw new UnauthorizedException('Invalid API key scope');
    }
    key.lastUsedAt = new Date();
    await this.apiKeyRepository.save(key);
    return key;
  }

  async createWebhook(firmId: string, dto: CreateWebhookDto): Promise<Webhook> {
    return this.webhookRepository.save(
      this.webhookRepository.create({
        firmId,
        url: dto.url,
        eventsJson: dto.events,
        secret: randomBytes(32).toString('hex'),
        isActive: true,
      }),
    );
  }

  async listWebhooks(firmId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({ where: { firmId, isActive: true } });
  }

  signWebhook(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
