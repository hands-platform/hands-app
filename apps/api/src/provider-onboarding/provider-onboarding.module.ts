import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProviderOnboardingController } from './provider-onboarding.controller';
import { ProviderOnboardingService } from './provider-onboarding.service';
import { TAX_POLICY_ACTIVATION_QUEUE_NAME } from './tax-policy-activation.queue';
import { TaxPolicyActivationProcessor } from './tax-policy-activation.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: TAX_POLICY_ACTIVATION_QUEUE_NAME }),
    NotificationsModule,
  ],
  controllers: [ProviderOnboardingController],
  providers: [ProviderOnboardingService, TaxPolicyActivationProcessor],
  exports: [ProviderOnboardingService],
})
export class ProviderOnboardingModule {}
