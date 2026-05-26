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

  test('validates provider price against minimum, step, and payout rule', () {
    const service = ProviderServicePrice(
      id: 'svc-aroma-60',
      name: 'Aroma Massage',
      durationMin: 60,
      basePrice: 500000,
      priceStep: 100000,
      effectivePrice: 500000,
      active: true,
      payoutRuleConfigured: true,
      payoutOptions: [
        ProviderServicePayoutOption(
          customerPrice: 500000,
          providerPayoutAmount: 380000,
          platformFee: 120000,
        ),
        ProviderServicePayoutOption(
          customerPrice: 700000,
          providerPayoutAmount: 540000,
          platformFee: 160000,
        ),
      ],
    );

    expect(
      service.validationMessageForPrice(null, active: true),
      'Enter a valid VND amount.',
    );
    expect(
      service.validationMessageForPrice(400000, active: true),
      'Price must be at least the HANDS minimum.',
    );
    expect(
      service.validationMessageForPrice(550000, active: true),
      'Price must follow the configured VND step.',
    );
    expect(
      service.validationMessageForPrice(600000, active: true),
      'Active services require an exact admin payout rule for this price.',
    );
    expect(service.validationMessageForPrice(600000, active: false), isNull);
    expect(service.canSavePrice(700000, active: true), isTrue);
  });

  test('requires admin payout rule before activating a new duration option', () {
    const service = ProviderServicePrice(
      id: 'svc-head-120',
      name: 'Head Massage',
      durationMin: 120,
      basePrice: 900000,
      priceStep: 100000,
      effectivePrice: 900000,
      active: false,
      payoutRuleConfigured: false,
    );

    expect(service.hasBookablePriceOptions, isFalse);
    expect(
      service.validationMessageForPrice(900000, active: true),
      'Admin must create a payout rule before this service can be activated.',
    );
    expect(service.validationMessageForPrice(900000, active: false), isNull);
  });
}
