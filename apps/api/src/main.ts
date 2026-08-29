import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { requestIdMiddleware } from './observability/request-id.middleware';
import { RedisStateService } from './redis/redis-state.service';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { corsOriginFromEnv } from './security/cors-origin';
import { apiRateLimitPolicies, rateLimitMiddleware } from './security/rate-limit.middleware';
import { securityHeadersMiddleware } from './security/security-headers.middleware';
import { trustProxyFromConfig } from './security/trust-proxy';
import { assertSiteContentPreviewStartupConfig } from './site-content/site-content-preview-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  assertSiteContentPreviewStartupConfig(config);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  const redisIoAdapter = new RedisIoAdapter(
    app,
    config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
  );
  await redisIoAdapter.connect();
  app.useWebSocketAdapter(redisIoAdapter);
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyFromConfig(config));
  app.enableCors({ origin: corsOriginFromEnv(), credentials: true, exposedHeaders: ['x-request-id'] });
  app.use(securityHeadersMiddleware);
  app.use(requestIdMiddleware);
  const redisState = app.get(RedisStateService);
  for (const policy of apiRateLimitPolicies) {
    app.use(rateLimitMiddleware(policy, redisState));
  }
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  await app.listen(config.get<number>('API_PORT') ?? 3000);
}

bootstrap();
