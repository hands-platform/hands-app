import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { requestIdMiddleware } from './observability/request-id.middleware';
import { corsOriginFromEnv } from './security/cors-origin';
import { apiRateLimitPolicies, rateLimitMiddleware } from './security/rate-limit.middleware';
import { securityHeadersMiddleware } from './security/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableCors({ origin: corsOriginFromEnv(), credentials: true, exposedHeaders: ['x-request-id'] });
  app.use(securityHeadersMiddleware);
  app.use(requestIdMiddleware);
  for (const policy of apiRateLimitPolicies) {
    app.use(rateLimitMiddleware(policy));
  }
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);
  await app.listen(config.get<number>('API_PORT') ?? 3000);
}

bootstrap();
