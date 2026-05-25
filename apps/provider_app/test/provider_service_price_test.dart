import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/provider_services/domain/entities/provider_service_price.dart';

void main() {
  test('filters bookable payout options by minimum price and step', () {
    final service = ProviderServicePrice(
      id: 'svc-foot-60',
      name: 'Foot Massage',
      durationMin: 60,
      basePrice: 500000,
      priceStep: 100000,
      effectivePrice: 500000,
      active: true,
      payoutRuleConfigured: true,
      payoutOptions: const [
        ProviderServicePayoutOption(
          customerPrice: 450000,
          providerPayoutAmount: 350000,
          platformFee: 100000,
        ),
        ProviderServicePayoutOption(
          customerPrice: 500000,
          providerPayoutAmount: 380000,
          platformFee: 120000,
        ),
        ProviderServicePayoutOption(
          customerPrice: 550000,
          providerPayoutAmount: 420000,
          platformFee: 130000,
        ),
        ProviderServicePayoutOption(
          customerPrice: 600000,
          providerPayoutAmount: 460000,
          platformFee: 140000,
        ),
      ],
    );

    expect(
      service.bookablePayoutOptions.map((option) => option.customerPrice),
      [500000, 600000],
    );
    expect(service.lowestBookablePayoutOption?.customerPrice, 500000);
    expect(service.canActivateAtCurrentPrice, isTrue);
  });

  test('marks current provider price as blocked when below admin minimum', () {
    final service = ProviderServicePrice(
      id: 'svc-swedish-60',
      name: 'Swedish Massage',
      durationMin: 60,
      basePrice: 500000,
      priceStep: 100000,
      providerPrice: 450000,
      effectivePrice: 450000,
      active: true,
      payoutRuleConfigured: true,
      payoutOptions: const [
        ProviderServicePayoutOption(
          customerPrice: 450000,
          providerPayoutAmount: 350000,
          platformFee: 100000,
        ),
        ProviderServicePayoutOption(
          customerPrice: 500000,
          providerPayoutAmount: 380000,
          platformFee: 120000,
        ),
      ],
    );

    expect(service.currentPriceBelowMinimum, isTrue);
    expect(service.canActivateAtCurrentPrice, isFalse);
    expect(service.recommendedCustomerPrice, 500000);
  });
}
