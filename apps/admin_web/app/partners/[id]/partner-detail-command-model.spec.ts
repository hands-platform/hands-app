import type { ProviderDetail } from './partner-detail-types';
import { buildProviderServicePricing } from './partner-detail-command-model';

describe('Partner detail command model', () => {
  it('marks only an active service with an exact payout rule as bookable', () => {
    const provider = {
      services: [
        {
          active: true,
          id: 'partner-service',
          price: 500_000,
          service: {
            active: true,
            basePrice: 450_000,
            durationMin: 60,
            id: 'service',
            name: 'Massage',
            payoutRules: [
              {
                customerPrice: 500_000,
                providerPayoutAmount: 350_000,
              },
            ],
          },
        },
      ],
    } as ProviderDetail;

    expect(buildProviderServicePricing(provider)).toEqual({
      readyCount: 1,
      rows: [
        expect.objectContaining({
          bookable: true,
          customerPrice: 500_000,
          providerPayoutAmount: 350_000,
        }),
      ],
    });
  });
});
