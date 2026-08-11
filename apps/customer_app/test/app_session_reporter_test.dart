import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/app_session_reporter.dart';
import 'package:customer_app/src/core/customer_marketing_attribution.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({
      'test-device': 'device-1',
      'test-address': 'District 1, Ho Chi Minh City',
      'test-attribution':
          '{"source":"google","campaignId":"launch-hcm","medium":"cpc",'
              '"capturedAt":"2026-07-23T01:00:00.000Z"}',
    });
  });

  test(
      'records session start and app open as separate idempotent client events',
      () async {
    final api = _FakeApiClient();
    const storage = FlutterSecureStorage();
    final reporter = AppSessionReporter(
      api: api,
      addressStorageKey: 'test-address',
      storage: storage,
      role: 'CUSTOMER',
      storageKey: 'test-device',
      marketingAttributionStore: CustomerMarketingAttributionStore(
        storage: FlutterSecureStorage(),
        storageKey: 'test-attribution',
      ),
    );

    await reporter.recordSessionStart();
    await reporter.recordAppOpen();

    expect(api.postBodies, hasLength(2));
    expect(api.postBodies[0]['eventType'], 'SESSION_START');
    expect(
        api.postBodies[0]['clientEventId'], startsWith('hands-session-start-'));
    expect(api.postBodies[1]['eventType'], 'APP_OPEN');
    expect(api.postBodies[1]['clientEventId'], startsWith('hands-app-open-'));
    expect(api.postBodies[0]['deviceId'], 'device-1');
    expect(
        api.postBodies[0]['lastLoginAddress'], 'District 1, Ho Chi Minh City');
    expect(api.postBodies[0]['metadata'], {
      'marketingAttribution': {
        'source': 'google',
        'campaignId': 'launch-hcm',
        'medium': 'cpc',
        'capturedAt': '2026-07-23T01:00:00.000Z',
      },
    });
    expect(api.postBodies[0]['clientEventId'],
        isNot(api.postBodies[1]['clientEventId']));
  });

  test('legacy heartbeat updates the session without creating an event',
      () async {
    final api = _FakeApiClient();
    final reporter = AppSessionReporter(
      api: api,
      addressStorageKey: 'test-address',
      storage: const FlutterSecureStorage(),
      role: 'CUSTOMER',
      storageKey: 'test-device',
    );

    await reporter.recordHeartbeat();

    expect(api.postBodies.single, isNot(contains('eventType')));
    expect(api.postBodies.single, isNot(contains('clientEventId')));
  });

  test('concurrent login events share one persisted device id', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final api = _FakeApiClient();
    final reporter = AppSessionReporter(
      api: api,
      addressStorageKey: 'test-address',
      storage: const FlutterSecureStorage(),
      role: 'CUSTOMER',
      storageKey: 'test-device',
    );

    await Future.wait(
        [reporter.recordSessionStart(), reporter.recordAppOpen()]);

    expect(api.postBodies, hasLength(2));
    expect(
        api.postBodies.map((body) => body['deviceId']).toSet(), hasLength(1));
  });

  test('sessionizes foreground app opens into a 30 minute window', () {
    final lastReportedAt = DateTime.utc(2026, 7, 19, 3);

    expect(
      shouldReportAppOpen(
        now: lastReportedAt.add(const Duration(minutes: 29, seconds: 59)),
        lastReportedAt: lastReportedAt,
      ),
      isFalse,
    );
    expect(
      shouldReportAppOpen(
        now: lastReportedAt.add(appOpenSessionWindow),
        lastReportedAt: lastReportedAt,
      ),
      isTrue,
    );
    expect(
      shouldReportAppOpen(
        now: lastReportedAt.subtract(const Duration(minutes: 1)),
        lastReportedAt: lastReportedAt,
      ),
      isTrue,
    );
  });
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient() : super(baseUrl: 'http://test.local');

  final List<Map<String, dynamic>> postBodies = [];

  @override
  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    expect(path, '/app/session');
    postBodies.add(body);
    return <String, dynamic>{};
  }
}
