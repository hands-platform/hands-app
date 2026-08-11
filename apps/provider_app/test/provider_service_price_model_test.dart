import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/features/provider_services/data/models/provider_service_price_model.dart';
import 'package:provider_app/src/features/provider_services/data/repositories/provider_service_price_repository_impl.dart';
import 'package:provider_app/src/features/provider_services/domain/entities/provider_service_price.dart';

void main() {
  test('parses payout rule fee details for partner service pricing', () {
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
    expect(service.hasPayoutOptionForPrice(500000), isTrue);
    expect(service.hasPayoutOptionForPrice(700000), isFalse);
    expect(
      service.payoutOptionForPrice(600000)?.providerPayoutAmount,
      460000,
    );
    expect(service.payoutOptions, hasLength(2));
    expect(service.payoutOptions.last.customerPrice, 600000);
    expect(service.payoutOptions.last.providerPayoutAmount, 460000);
  });

  test('update service picks payout rule that matches the selected price',
      () async {
    final repository = ProviderServicePriceRepositoryImpl(_FakeApiClient(
      patchResponse: {
        'id': 'provider-service-1',
        'price': 600000,
        'active': true,
        'service': {
          'id': 'svc-foot-60',
          'name': 'Foot Massage',
          'durationMin': 60,
          'basePrice': 500000,
          'priceStep': 100000,
          'payoutRules': [
            {
              'customerPrice': 500000,
              'providerPayoutAmount': 380000,
              'currency': 'VND',
            },
            {
              'customerPrice': 600000,
              'providerPayoutAmount': 460000,
              'currency': 'VND',
            },
          ],
        },
      },
    ));

    final service = await repository.updateService(
      serviceId: 'svc-foot-60',
      price: 600000,
      active: true,
    );

    expect(service.effectivePrice, 600000);
    expect(service.providerPayoutAmount, 460000);
    expect(service.platformFee, 140000);
    expect(service.payoutRuleConfigured, isTrue);
  });

  test('update service handles numeric strings from the service API', () async {
    final repository = ProviderServicePriceRepositoryImpl(_FakeApiClient(
      patchResponse: {
        'id': 'provider-service-1',
        'price': '600000',
        'active': true,
        'service': {
          'id': 'svc-foot-60',
          'name': 'Foot Massage',
          'durationMin': '60',
          'basePrice': '500000',
          'priceStep': '100000',
          'payoutRules': [
            {
              'customerPrice': '600000',
              'providerPayoutAmount': '460000',
              'currency': 'VND',
            },
          ],
        },
      },
    ));

    final service = await repository.updateService(
      serviceId: 'svc-foot-60',
      price: 600000,
      active: true,
    );

    expect(service.durationMin, 60);
    expect(service.effectivePrice, 600000);
    expect(service.providerPayoutAmount, 460000);
    expect(service.platformFee, 140000);
    expect(service.payoutOptions.single.platformFee, 140000);
  });

  test('list services flattens grouped partner service catalog response',
      () async {
    final api = _FakeApiClient(
      getResponse: [
        {
          'key': 'foot_massage',
          'name': 'Foot Massage',
          'durationSummary': '60 phút, 90 phút',
          'options': [
            {
              'id': 'svc-foot-60',
              'serviceGroupKey': 'foot_massage',
              'name': 'Foot Massage',
              'durationMin': 60,
              'basePrice': 500000,
              'priceStep': 100000,
              'effectivePrice': 500000,
              'active': true,
              'payoutRuleConfigured': true,
            },
            {
              'id': 'svc-foot-90',
              'serviceGroupKey': 'foot_massage',
              'name': 'Foot Massage',
              'durationMin': 90,
              'basePrice': 700000,
              'priceStep': 100000,
              'effectivePrice': 700000,
              'active': true,
              'payoutRuleConfigured': true,
            },
          ],
        },
      ],
    );
    final repository = ProviderServicePriceRepositoryImpl(api);

    final services = await repository.listServices();

    expect(api.getPath, '/partner/services/groups');
    expect(services, hasLength(2));
    expect(services.map((service) => service.id), [
      'svc-foot-60',
      'svc-foot-90',
    ]);
    expect(services.first.serviceGroupKey, 'foot_massage');
  });

  test('groups partner service prices by service name and duration options',
      () {
    final groups = groupProviderServicePrices([
      const ProviderServicePrice(
        id: 'svc-foot-90',
        serviceGroupKey: 'foot_massage',
        name: 'Foot Massage',
        durationMin: 90,
        basePrice: 700000,
        priceStep: 100000,
        effectivePrice: 700000,
        active: true,
        payoutRuleConfigured: true,
      ),
      const ProviderServicePrice(
        id: 'svc-head-60',
        serviceGroupKey: 'head_massage',
        name: 'Head Massage',
        durationMin: 60,
        basePrice: 500000,
        priceStep: 100000,
        effectivePrice: 500000,
        active: true,
        payoutRuleConfigured: true,
      ),
      const ProviderServicePrice(
        id: 'svc-foot-60',
        serviceGroupKey: 'foot_massage',
        name: 'Foot Massage',
        durationMin: 60,
        basePrice: 500000,
        priceStep: 100000,
        effectivePrice: 600000,
        active: true,
        payoutRuleConfigured: true,
      ),
    ]);

    expect(groups, hasLength(2));
    expect(groups.first.key, 'foot_massage');
    expect(groups.first.name, 'Foot Massage');
    expect(groups.first.durationSummary, '60 phút, 90 phút');
    expect(groups.first.options.map((option) => option.durationMin), [60, 90]);
    expect(groups.first.allStandardDurationsReady, isFalse);
    expect(groups.first.payoutReadyOptionCount, 2);
    expect(groups.first.payoutMissingOptionCount, 0);
  });

  test('counts active options that still need payout rules', () {
    final groups = groupProviderServicePrices([
      const ProviderServicePrice(
        id: 'svc-foot-60',
        serviceGroupKey: 'foot_massage',
        name: 'Foot Massage',
        durationMin: 60,
        basePrice: 500000,
        priceStep: 100000,
        effectivePrice: 500000,
        active: true,
        payoutRuleConfigured: true,
      ),
      const ProviderServicePrice(
        id: 'svc-foot-90',
        serviceGroupKey: 'foot_massage',
        name: 'Foot Massage',
        durationMin: 90,
        basePrice: 700000,
        priceStep: 100000,
        effectivePrice: 800000,
        active: true,
        payoutRuleConfigured: false,
      ),
      const ProviderServicePrice(
        id: 'svc-foot-120',
        serviceGroupKey: 'foot_massage',
        name: 'Foot Massage',
        durationMin: 120,
        basePrice: 900000,
        priceStep: 100000,
        effectivePrice: 900000,
        active: false,
        payoutRuleConfigured: false,
      ),
    ]);

    expect(groups.single.payoutReadyOptionCount, 1);
    expect(groups.single.payoutMissingOptionCount, 1);
  });
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient({
    this.getResponse = const <dynamic>[],
    this.patchResponse = const <String, dynamic>{},
  }) : super(baseUrl: 'http://test.local');

  final dynamic getResponse;
  final Map<String, dynamic> patchResponse;
  String? getPath;

  @override
  Future<dynamic> getJson(String path) async {
    getPath = path;
    return getResponse;
  }

  @override
  Future<dynamic> patchJson(String path, Map<String, dynamic> body) async {
    expect(path, '/partner/services/svc-foot-60');
    expect(body['price'], 600000);
    expect(body['active'], isTrue);
    return patchResponse;
  }
}
