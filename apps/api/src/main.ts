import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { requestIdMiddleware } from './observability/request-id.middleware';
import { corsOriginFromEnv } from './security/cors-origin';
import { rateLimitMiddleware } from './security/rate-limit.middleware';
import { securityHeadersMiddleware } from './security/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: corsOriginFromEnv(), credentials: true, exposedHeaders: ['x-request-id'] });
  app.use(securityHeadersMiddleware);
  app.use(requestIdMiddleware);
  app.use(rateLimitMiddleware({ windowMs: 60_000, max: 30, pathPattern: /^\/api\/auth\// }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);
  await app.listen(config.get<number>('API_PORT') ?? 3000);
}

bootstrap();
