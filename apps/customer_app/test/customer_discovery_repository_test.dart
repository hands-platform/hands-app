import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/app_session_reporter.dart';
import 'package:customer_app/src/features/discovery/data/repositories/customer_discovery_repository_impl.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('list services flattens grouped public service catalog response',
      () async {
    final api = _FakeApiClient([
      {
        'key': 'foot_massage',
        'name': 'Foot Massage',
        'durationSummary': '60 min, 90 min',
        'options': [
          {
            'id': 'svc-foot-60',
            'serviceGroupKey': 'foot_massage',
            'name': 'Foot Massage',
            'durationMin': 60,
            'basePrice': 500000,
          },
          {
            'id': 'svc-foot-90',
            'serviceGroupKey': 'foot_massage',
            'name': 'Foot Massage',
            'durationMin': 90,
            'basePrice': 700000,
          },
        ],
      },
    ]);
    final repository = CustomerDiscoveryRepositoryImpl(
      api,
      AppSessionReporter(
        api: api,
        addressStorageKey: 'test-customer-address',
        storage: const FlutterSecureStorage(),
        role: 'CUSTOMER',
        storageKey: 'test-customer-device',
      ),
    );

    final services = await repository.listServices();

    expect(api.getPath, '/services/groups');
    expect(services, hasLength(2));
    expect(services.first['id'], 'svc-foot-60');
    expect(services.last['durationMin'], 90);
  });

  test('recordProviderProfileView posts a lightweight profile view event',
      () async {
    final api = _FakeApiClient({'ok': true});
    final repository = CustomerDiscoveryRepositoryImpl(
      api,
      AppSessionReporter(
        api: api,
        addressStorageKey: 'test-customer-address',
        storage: const FlutterSecureStorage(),
        role: 'CUSTOMER',
        storageKey: 'test-customer-device',
      ),
    );

    await repository.recordProviderProfileView('partner-1');

    expect(api.postPath, '/customer/partners/partner-1/view');
    expect(api.postBody?['clientEventId'],
        startsWith('hands-provider-profile-view-'));
  });

  test('home summary loads the customer wallet and partner shortcuts',
      () async {
    final api = _FakeApiClient({
      'wallet': {'balance': 250000, 'currency': 'VND'},
      'favoritePartners': [
        {'id': 'partner-1', 'distanceMeters': 1000},
      ],
      'completedPartners': [
        {'id': 'partner-2', 'distanceMeters': 2000},
      ],
    });
    final repository = CustomerDiscoveryRepositoryImpl(
      api,
      AppSessionReporter(
        api: api,
        addressStorageKey: 'test-customer-address',
        storage: const FlutterSecureStorage(),
        role: 'CUSTOMER',
        storageKey: 'test-customer-device',
      ),
    );

    final result = await repository.getHomeSummary(lat: 10.7769, lng: 106.7009);

    expect(api.getPath, '/customer/home-summary?lat=10.7769&lng=106.7009');
    expect(result['wallet'], {'balance': 250000, 'currency': 'VND'});
    expect(result['favoritePartners'], hasLength(1));
    expect(result['completedPartners'], hasLength(1));
  });

  test('wallet loads balance and recent activity from the customer endpoint',
      () async {
    final api = _FakeApiClient({
      'balance': 170000,
      'currency': 'VND',
      'entries': [
        {'id': 'entry-1', 'amount': 70000, 'type': 'REFERRAL_REWARD'},
      ],
    });
    final repository = CustomerDiscoveryRepositoryImpl(
      api,
      AppSessionReporter(
        api: api,
        addressStorageKey: 'test-customer-address',
        storage: const FlutterSecureStorage(),
        role: 'CUSTOMER',
        storageKey: 'test-customer-device',
      ),
    );

    final result = await repository.getWallet();

    expect(api.getPath, '/customer/wallet');
    expect(result['balance'], 170000);
    expect(result['entries'], hasLength(1));
  });
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient(this.response) : super(baseUrl: 'http://test.local');

  final dynamic response;
  String? getPath;
  String? postPath;
  Map<String, dynamic>? postBody;

  @override
  Future<dynamic> getJson(String path) async {
    getPath = path;
    return response;
  }

  @override
  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    postPath = path;
    postBody = body;
    return response;
  }
}
