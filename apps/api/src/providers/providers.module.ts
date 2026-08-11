import { Module } from '@nestjs/common';
import { ProviderAvailabilityReconciliationService } from './provider-availability-reconciliation.service';
import { ProviderAvailabilityLifecycleService } from './provider-availability-lifecycle.service';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  controllers: [ProvidersController],
  providers: [
    ProviderAvailabilityLifecycleService,
    ProviderAvailabilityReconciliationService,
    ProvidersService,
  ],
  exports: [ProviderAvailabilityLifecycleService, ProvidersService],
})
export class ProvidersModule {}
