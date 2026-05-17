import { BadRequestException, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { WinstonAppLogger } from './common/logger/winston-app.logger';
import { BodyTrimMiddleware } from './common/middleware/body-trim.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.useLogger(new WinstonAppLogger());

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
    credentials: true,
  });
  app.use(
    rateLimit({
      windowMs: Number(config.get<string>('REQUEST_RATE_LIMIT_WINDOW_MS') ?? 60_000),
      max: Number(config.get<string>('REQUEST_RATE_LIMIT_MAX') ?? 120),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(new RequestIdMiddleware().use);
  // Drop empty-string fields + trim whitespace BEFORE validation pipe sees the
  // body, so optional inputs left blank don't trigger 400s on strict validators.
  app.use(new BodyTrimMiddleware().use);

  app.setGlobalPrefix(config.get<string>('API_PREFIX') ?? 'api/v1', {
    exclude: ['health', 'health/ready'],
  });
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Compose a friendly human message from the first failing constraint
      // so the frontend can surface it directly instead of "Request failed: 400".
      exceptionFactory: (errors: ValidationError[]) => {
        const flatten = (err: ValidationError, parent = ''): string[] => {
          const path = parent ? `${parent}.${err.property}` : err.property;
          const here = err.constraints ? Object.values(err.constraints).map((m) => `${path}: ${m}`) : [];
          const nested = (err.children ?? []).flatMap((c) => flatten(c, path));
          return [...here, ...nested];
        };
        const messages = errors.flatMap((e) => flatten(e));
        const primary = messages[0] ?? 'Invalid input';
        return new BadRequestException({
          message: primary,
          details: messages,
        });
      },
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CA Practice Management API')
    .setDescription('REST API for multi-tenant CA practice management')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(Number(config.get<string>('PORT') ?? 3000));
}

void bootstrap();
