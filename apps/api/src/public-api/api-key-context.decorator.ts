import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyRequest } from './api-key-auth.guard';

export const ApiKeyContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<ApiKeyRequest>();
  return request.apiKeyContext;
});
