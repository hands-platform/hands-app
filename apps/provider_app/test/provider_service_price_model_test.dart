import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/provider_services/data/models/provider_service_price_model.dart';

void main() {
  test('parses payout rule fee details for provider service pricing', () {
    final service = ProviderServicePriceModel.fromJson({
      'id': 'svc-foot-60',
      'name': 'Foot Massage',
      'durationMin': 60,
      'basePrice': 500000,
      'priceStep': 100000,
      'effectivePrice': 500000,
      'active': true,
      'payoutRuleConfigured': true,
      'payoutRule': {
        'providerPayoutAmount': 380000,
        'platformFee': 120000,
        'vatBps': 1000,
        'otherCostAmount': 5000,
        'currency': 'VND',
      },
      'payoutOptions': [
        {
          'customerPrice': 500000,
          'providerPayoutAmount': 380000,
          'platformFee': 120000,
          'currency': 'VND',
        },
        {
          'customerPrice': 600000,
          'providerPayoutAmount': 460000,
          'platformFee': 140000,
          'currency': 'VND',
        },
      ],
    });

    expect(service.providerPayoutAmount, 380000);
    expect(service.platformFee, 120000);
    expect(service.estimatedVatAmount, 12000);
    expect(service.estimatedCompanyFeeAfterCosts, 103000);
    expect(service.payoutOptions, hasLength(2));
    expect(service.payoutOptions.last.customerPrice, 600000);
    expect(service.payoutOptions.last.providerPayoutAmount, 460000);
  });
}
