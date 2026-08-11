import 'dart:async';

import 'package:customer_app/src/core/customer_marketing_attribution.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  test('normalizes supported UTM parameters from a customer app link', () {
    final attribution = customerMarketingAttributionFromUri(
      Uri.parse(
        'hands://open?utm_source=Google%20Ads'
        '&utm_campaign=launch-hcm&utm_medium=cpc',
      ),
      capturedAt: DateTime.utc(2026, 7, 23, 1),
    );

    expect(attribution?.toJson(), {
      'source': 'google',
      'campaignId': 'launch-hcm',
      'medium': 'cpc',
      'capturedAt': '2026-07-23T01:00:00.000Z',
    });
  });

  test('rejects unsupported source values', () {
    expect(
      customerMarketingAttributionFromUri(
        Uri.parse('hands://open?utm_source=untrusted-network'),
      ),
      isNull,
    );
  });

  test('rejects attribution from unregistered link origins', () {
    expect(
      customerMarketingAttributionFromUri(
        Uri.parse('untrusted://open?utm_source=google&utm_campaign=spoofed'),
      ),
      isNull,
    );
    expect(
      customerMarketingAttributionFromUri(
        Uri.parse('hands://unexpected?utm_source=google&utm_campaign=spoofed'),
      ),
      isNull,
    );
  });

  test('infers paid sources from platform click ids without storing the id',
      () {
    final google = customerMarketingAttributionFromUri(
      Uri.parse('hands://open?GCLID=sensitive-click-id&utm_id=launch-hcm'),
      capturedAt: DateTime.utc(2026, 7, 23, 1),
    );
    final meta = customerMarketingAttributionFromUri(
      Uri.parse('hands://open?fbclid=sensitive-click-id'),
      capturedAt: DateTime.utc(2026, 7, 23, 2),
    );
    final tiktok = customerMarketingAttributionFromUri(
      Uri.parse('hands://open?ttclid=sensitive-click-id'),
      capturedAt: DateTime.utc(2026, 7, 23, 3),
    );

    expect(google?.toJson(), {
      'source': 'google',
      'campaignId': 'launch-hcm',
      'capturedAt': '2026-07-23T01:00:00.000Z',
    });
    expect(meta?.source, 'meta');
    expect(tiktok?.source, 'tiktok');
    expect(google?.toJson().toString(), isNot(contains('sensitive-click-id')));
  });

  test('keeps the first captured attribution', () async {
    final store = CustomerMarketingAttributionStore(
      storage: FlutterSecureStorage(),
      storageKey: 'test-marketing-attribution',
    );

    expect(
      await store.captureUri(
        Uri.parse(
          'hands://open?utm_source=google&utm_campaign=first-touch',
        ),
        capturedAt: DateTime.utc(2026, 7, 20),
      ),
      isTrue,
    );
    expect(
      await store.captureUri(
        Uri.parse(
          'hands://open?utm_source=tiktok&utm_campaign=later-touch',
        ),
        capturedAt: DateTime.utc(2026, 7, 23),
      ),
      isFalse,
    );
    expect((await store.read())?.toJson(), {
      'source': 'google',
      'campaignId': 'first-touch',
      'capturedAt': '2026-07-20T00:00:00.000Z',
    });
  });

  test('serializes concurrent captures so only the first touch is stored',
      () async {
    final store = CustomerMarketingAttributionStore(
      storage: const FlutterSecureStorage(),
      storageKey: 'test-concurrent-attribution',
    );

    final results = await Future.wait([
      store.captureUri(
        Uri.parse('hands://open?utm_source=google&utm_campaign=first'),
        capturedAt: DateTime.utc(2026, 7, 20),
      ),
      store.captureUri(
        Uri.parse('hands://open?utm_source=meta&utm_campaign=second'),
        capturedAt: DateTime.utc(2026, 7, 21),
      ),
    ]);

    expect(results, [isTrue, isFalse]);
    expect((await store.read())?.toJson(), {
      'source': 'google',
      'campaignId': 'first',
      'capturedAt': '2026-07-20T00:00:00.000Z',
    });
  });

  test('records direct fallback once and preserves it across app restarts',
      () async {
    final firstRun = CustomerMarketingAttributionStore(
      storage: const FlutterSecureStorage(),
      storageKey: 'test-direct-attribution',
    );

    expect(
      await firstRun.captureDirectFallback(
        capturedAt: DateTime.utc(2026, 7, 20),
      ),
      isTrue,
    );

    final restartedApp = CustomerMarketingAttributionStore(
      storage: const FlutterSecureStorage(),
      storageKey: 'test-direct-attribution',
    );
    expect(
      await restartedApp.captureUri(
        Uri.parse('hands://open?utm_source=tiktok&utm_campaign=later'),
        capturedAt: DateTime.utc(2026, 7, 21),
      ),
      isFalse,
    );
    expect((await restartedApp.read())?.toJson(), {
      'source': 'direct',
      'medium': 'app-open',
      'capturedAt': '2026-07-20T00:00:00.000Z',
    });
  });

  test('capture startup keeps the initial paid link ahead of direct fallback',
      () async {
    final store = CustomerMarketingAttributionStore(
      storage: const FlutterSecureStorage(),
      storageKey: 'test-startup-initial-link',
    );
    final source = _FakeMarketingLinkSource(
      initialLink: Uri.parse(
        'hands://open?utm_source=google&utm_campaign=cold-start',
      ),
    );
    final capture = CustomerMarketingAttributionCapture(
      store: store,
      linkSource: source,
    );

    await capture.start();

    expect((await store.read())?.toJson(), {
      'source': 'google',
      'campaignId': 'cold-start',
      'capturedAt': isNotEmpty,
    });
    await capture.dispose();
    await source.close();
  });

  test('capture startup uses direct fallback when no campaign link exists',
      () async {
    final store = CustomerMarketingAttributionStore(
      storage: const FlutterSecureStorage(),
      storageKey: 'test-startup-direct',
    );
    final source = _FakeMarketingLinkSource();
    final capture = CustomerMarketingAttributionCapture(
      store: store,
      linkSource: source,
    );

    await capture.start();

    expect((await store.read())?.toJson(), {
      'source': 'direct',
      'medium': 'app-open',
      'capturedAt': isNotEmpty,
    });
    await capture.dispose();
    await source.close();
  });

  test('streamed paid link cannot be lost while initial link is resolving',
      () async {
    final store = CustomerMarketingAttributionStore(
      storage: const FlutterSecureStorage(),
      storageKey: 'test-startup-stream-race',
    );
    final initialLink = Completer<Uri?>();
    final source = _FakeMarketingLinkSource(
      initialLinkLoader: () => initialLink.future,
      sync: true,
    );
    final capture = CustomerMarketingAttributionCapture(
      store: store,
      linkSource: source,
    );

    final startup = capture.start();
    source.add(
      Uri.parse('hands://open?fbclid=private-click-id&utm_campaign=streamed'),
    );
    initialLink.complete(null);
    await startup;

    expect((await store.read())?.toJson(), {
      'source': 'meta',
      'campaignId': 'streamed',
      'capturedAt': isNotEmpty,
    });
    await capture.dispose();
    await source.close();
  });
}

class _FakeMarketingLinkSource implements CustomerMarketingLinkSource {
  _FakeMarketingLinkSource({
    this.initialLink,
    this.initialLinkLoader,
    bool sync = false,
  }) : _controller = StreamController<Uri>(sync: sync);

  final Uri? initialLink;
  final Future<Uri?> Function()? initialLinkLoader;
  final StreamController<Uri> _controller;

  @override
  Future<Uri?> getInitialLink() {
    return initialLinkLoader?.call() ?? Future<Uri?>.value(initialLink);
  }

  @override
  Stream<Uri> get uriLinkStream => _controller.stream;

  void add(Uri uri) => _controller.add(uri);

  Future<void> close() => _controller.close();
}
