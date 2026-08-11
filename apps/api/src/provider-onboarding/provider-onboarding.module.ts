import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProviderOnboardingController } from './provider-onboarding.controller';
import { ProviderOnboardingService } from './provider-onboarding.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ProviderOnboardingController],
  providers: [ProviderOnboardingService],
  exports: [ProviderOnboardingService],
})
export class ProviderOnboardingModule {}
