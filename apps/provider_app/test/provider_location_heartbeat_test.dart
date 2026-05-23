import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/map/domain/services/provider_location_heartbeat.dart';

void main() {
  test('runs an immediate location update by default', () async {
    var calls = 0;
    final heartbeat = ProviderLocationHeartbeat(() async {
      calls += 1;
    });

    await heartbeat.start();
    heartbeat.stop();

    expect(calls, 1);
    expect(heartbeat.snapshot.lastSuccessAt, isNotNull);
    expect(heartbeat.snapshot.active, isFalse);
  });

  test('can start timer without duplicating an already-sent location update',
      () async {
    var calls = 0;
    final heartbeat = ProviderLocationHeartbeat(() async {
      calls += 1;
    });

    await heartbeat.start(runImmediately: false);
    heartbeat.stop();

    expect(calls, 0);
    expect(heartbeat.snapshot.active, isFalse);
    expect(heartbeat.snapshot.lastSuccessAt, isNull);
  });

  test('publishes schedule state when timer starts without immediate update',
      () async {
    final snapshots = <ProviderLocationHeartbeatSnapshot>[];
    final heartbeat = ProviderLocationHeartbeat(() async {});
    final subscription = heartbeat.snapshots.listen(snapshots.add);

    await heartbeat.start(runImmediately: false);
    heartbeat.stop();
    await subscription.cancel();

    expect(snapshots, isNotEmpty);
    expect(snapshots.first.active, isTrue);
    expect(snapshots.first.nextUpdateAt, isNotNull);
    expect(snapshots.last.active, isFalse);
    expect(snapshots.last.nextUpdateAt, isNull);
  });

  test('records failed immediate updates and surfaces the error', () async {
    final heartbeat = ProviderLocationHeartbeat(() async {
      throw StateError('location denied');
    });

    await expectLater(heartbeat.start(), throwsStateError);
    heartbeat.stop();

    expect(heartbeat.snapshot.failureCount, 1);
    expect(heartbeat.snapshot.lastError, isA<StateError>());
  });

  test('can record an update performed before the timer starts', () async {
    var calls = 0;
    final heartbeat = ProviderLocationHeartbeat(() async {
      calls += 1;
    });

    await heartbeat.start(runImmediately: false);
    heartbeat.recordSuccessfulUpdate();
    heartbeat.stop();

    expect(calls, 0);
    expect(heartbeat.snapshot.successCount, 1);
    expect(heartbeat.snapshot.lastSuccessAt, isNotNull);
    expect(heartbeat.snapshot.active, isFalse);
  });
}
