import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IntegrationsService } from '../integrations/integrations.service';
import { API_SCOPE_KEY } from './api-scope.decorator';

export interface ApiKeyRequest extends Request {
  apiKeyContext?: {
    firmId: string;
    apiKeyId: string;
  };
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const header = request.header('authorization') ?? '';
    const rawKey = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!rawKey) throw new UnauthorizedException('Missing API key');
    const scope = this.reflector.getAllAndOverride<string>(API_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? 'read-only';
    const key = await this.integrationsService.validateRawKey(rawKey, scope);
    request.apiKeyContext = { firmId: key.firmId, apiKeyId: key.id };
    return true;
  }
}
