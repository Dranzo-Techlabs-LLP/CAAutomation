import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { WinstonAppLogger } from './common/logger/winston-app.logger';
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

  app.setGlobalPrefix(config.get<string>('API_PREFIX') ?? 'api/v1', {
    exclude: ['health', 'health/ready'],
  });
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
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
