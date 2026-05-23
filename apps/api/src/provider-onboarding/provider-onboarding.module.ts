import { Module } from '@nestjs/common';
import { ProviderOnboardingController } from './provider-onboarding.controller';
import { ProviderOnboardingService } from './provider-onboarding.service';

@Module({
  controllers: [ProviderOnboardingController],
  providers: [ProviderOnboardingService],
  exports: [ProviderOnboardingService],
})
export class ProviderOnboardingModule {}
