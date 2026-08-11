import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/core/app_session_reporter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({
      'test-device': 'provider-device-1',
    });
  });

  test('records Partner session start and app open as idempotent events',
      () async {
    final api = _FakeApiClient();
    final reporter = AppSessionReporter(
      api: api,
      storage: const FlutterSecureStorage(),
      role: 'PROVIDER',
      storageKey: 'test-device',
    );

    await reporter.recordSessionStart();
    await reporter.recordAppOpen();

    expect(api.postBodies, hasLength(2));
    expect(api.postBodies[0]['role'], 'PROVIDER');
    expect(api.postBodies[0]['eventType'], 'SESSION_START');
    expect(
        api.postBodies[0]['clientEventId'], startsWith('hands-session-start-'));
    expect(api.postBodies[1]['eventType'], 'APP_OPEN');
    expect(api.postBodies[1]['clientEventId'], startsWith('hands-app-open-'));
    expect(api.postBodies[0]['deviceId'], 'provider-device-1');
    expect(api.postBodies[0]['clientEventId'],
        isNot(api.postBodies[1]['clientEventId']));
  });

  test('legacy heartbeat updates presence without creating an event', () async {
    final api = _FakeApiClient();
    final reporter = AppSessionReporter(
      api: api,
      storage: const FlutterSecureStorage(),
      role: 'PROVIDER',
      storageKey: 'test-device',
    );

    await reporter.recordHeartbeat();

    expect(api.postBodies.single, isNot(contains('eventType')));
    expect(api.postBodies.single, isNot(contains('clientEventId')));
  });

  test('concurrent Partner login events share one persisted device id',
      () async {
    FlutterSecureStorage.setMockInitialValues({});
    final api = _FakeApiClient();
    final reporter = AppSessionReporter(
      api: api,
      storage: const FlutterSecureStorage(),
      role: 'PROVIDER',
      storageKey: 'test-device',
    );

    await Future.wait(
        [reporter.recordSessionStart(), reporter.recordAppOpen()]);

    expect(api.postBodies, hasLength(2));
    expect(
        api.postBodies.map((body) => body['deviceId']).toSet(), hasLength(1));
  });

  test('sessionizes Partner foreground app opens into a 30 minute window', () {
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
