import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/map/domain/services/provider_location_heartbeat.dart';

void main() {
  test('uses a cost-controlled idle refresh interval', () {
    expect(ProviderLocationHeartbeat.interval, const Duration(minutes: 60));
  });

  test('uses a cost-controlled active booking refresh interval', () {
    expect(
      ProviderLocationHeartbeat.activeBookingInterval,
      const Duration(minutes: 30),
    );
  });

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

  test('records active booking updates on the active booking schedule',
      () async {
    final heartbeat = ProviderLocationHeartbeat(() async {});
    final succeededAt = DateTime(2026, 6, 23, 9);

    await heartbeat.startActiveBooking(
      'booking-active-1',
      runImmediately: false,
    );
    heartbeat.recordSuccessfulUpdate(
      at: succeededAt,
      interval: ProviderLocationHeartbeat.activeBookingInterval,
      bookingId: 'booking-active-1',
    );
    final snapshot = heartbeat.snapshot;
    heartbeat.stop();

    expect(snapshot.successCount, 1);
    expect(snapshot.lastSuccessAt, succeededAt);
    expect(
      snapshot.nextUpdateAt,
      succeededAt.add(ProviderLocationHeartbeat.activeBookingInterval),
    );
    expect(snapshot.bookingId, 'booking-active-1');
    expect(
      snapshot.interval,
      ProviderLocationHeartbeat.activeBookingInterval,
    );
  });

  test('routes active booking heartbeat updates with the booking id', () async {
    final bookingUpdates = <String>[];
    var idleCalls = 0;
    final heartbeat = ProviderLocationHeartbeat(
      () async {
        idleCalls += 1;
      },
      updateBookingLocation: (bookingId) async {
        bookingUpdates.add(bookingId);
      },
    );

    await heartbeat.startActiveBooking('booking-active-2');
    heartbeat.stop();

    expect(idleCalls, 0);
    expect(bookingUpdates, ['booking-active-2']);
  });

  test('keeps manual offline state without starting location heartbeat',
      () async {
    var calls = 0;
    final heartbeat = ProviderLocationHeartbeat(() async {
      calls += 1;
    });

    final active = await heartbeat.syncForAvailability({
      'availabilityIntent': 'OFFLINE',
      'status': 'OFFLINE',
    });

    expect(active, isFalse);
    expect(calls, 0);
    expect(heartbeat.snapshot.active, isFalse);
  });

  test('refreshes location immediately when available Partner resumes',
      () async {
    var calls = 0;
    final heartbeat = ProviderLocationHeartbeat(() async {
      calls += 1;
    });

    final active = await heartbeat.syncForAvailability({
      'availabilityIntent': 'AVAILABLE',
      'status': 'ONLINE_AVAILABLE',
    });
    heartbeat.stop();

    expect(active, isTrue);
    expect(calls, 1);
    expect(heartbeat.snapshot.lastSuccessAt, isNotNull);
  });

  test('preserves active booking heartbeat context during foreground refresh',
      () async {
    final bookingUpdates = <String>[];
    final heartbeat = ProviderLocationHeartbeat(
      () async {},
      updateBookingLocation: (bookingId) async {
        bookingUpdates.add(bookingId);
      },
    );

    await heartbeat.startActiveBooking(
      'booking-active-resume',
      runImmediately: false,
    );
    await heartbeat.syncForAvailability({
      'availabilityIntent': 'AVAILABLE',
      'status': 'ONLINE_BUSY',
    });
    final snapshot = heartbeat.snapshot;
    heartbeat.stop();

    expect(bookingUpdates, ['booking-active-resume']);
    expect(snapshot.bookingId, 'booking-active-resume');
    expect(snapshot.interval, ProviderLocationHeartbeat.activeBookingInterval);
  });

  test('distinguishes availability intent from actual online status', () {
    expect(
      providerAvailabilityWantsLocationHeartbeat({
        'availabilityIntent': 'AVAILABLE',
        'status': 'OFFLINE',
        'availabilityReason': 'OUTSIDE_WORKING_HOURS',
      }),
      isTrue,
    );
    expect(
      providerAvailabilityIsOnline({
        'availabilityIntent': 'AVAILABLE',
        'status': 'OFFLINE',
      }),
      isFalse,
    );
  });
}
