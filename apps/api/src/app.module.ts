import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ChatModule } from './chat/chat.module';
import { CustomersModule } from './customers/customers.module';
import { EarningsModule } from './earnings/earnings.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { LocationsModule } from './locations/locations.module';
import { MatchingModule } from './matching/matching.module';
import { MobileModule } from './mobile/mobile.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProviderOnboardingModule } from './provider-onboarding/provider-onboarding.module';
import { ProvidersModule } from './providers/providers.module';
import { RedisModule } from './redis/redis.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ServicesModule } from './services/services.module';
import { SiteContentModule } from './site-content/site-content.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
          connectTimeout: 5_000,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 3,
        },
      }),
    }),
    BullModule.forRootAsync('worker', {
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
          maxRetriesPerRequest: null,
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProvidersModule,
    ProviderOnboardingModule,
    ServicesModule,
    SiteContentModule,
    BookingsModule,
    MatchingModule,
    MobileModule,
    ChatModule,
    PaymentsModule,
    NotificationsModule,
    EarningsModule,
    ReferralsModule,
    FilesModule,
    HealthModule,
    AdminModule,
    LocationsModule,
  ],
})
export class AppModule {}
