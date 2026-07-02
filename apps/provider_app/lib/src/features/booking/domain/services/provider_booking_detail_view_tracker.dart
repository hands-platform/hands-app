import 'dart:async';

enum ProviderBookingDetailViewTelemetryEvent {
  heartbeat,
  closed,
}

typedef ProviderBookingDetailViewTelemetryRecorder = Future<void> Function({
  required String bookingId,
  required ProviderBookingDetailViewTelemetryEvent eventType,
  Duration? duration,
});

class ProviderBookingDetailViewTracker {
  ProviderBookingDetailViewTracker({
    required ProviderBookingDetailViewTelemetryRecorder record,
    DateTime Function()? now,
  })  : _record = record,
        _now = now ?? DateTime.now;

  static const heartbeatInterval = Duration(seconds: 60);

  final ProviderBookingDetailViewTelemetryRecorder _record;
  final DateTime Function() _now;
  final Map<String, DateTime> _startedAtByBookingId = {};

  Future<void> syncVisibleBookingIds(Iterable<String> bookingIds) async {
    final nextIds =
        bookingIds.map((id) => id.trim()).where((id) => id.isNotEmpty).toSet();
    final currentIds = _startedAtByBookingId.keys.toSet();

    for (final removedId in currentIds.difference(nextIds)) {
      await _recordClosed(removedId);
      _startedAtByBookingId.remove(removedId);
    }

    final now = _now();
    for (final addedId in nextIds.difference(currentIds)) {
      _startedAtByBookingId[addedId] = now;
    }
  }

  Future<void> recordHeartbeat() async {
    for (final bookingId in _startedAtByBookingId.keys.toList()) {
      await _recordSafely(
        bookingId: bookingId,
        eventType: ProviderBookingDetailViewTelemetryEvent.heartbeat,
        duration: _durationFor(bookingId),
      );
    }
  }

  Future<void> closeAll() async {
    for (final bookingId in _startedAtByBookingId.keys.toList()) {
      await _recordClosed(bookingId);
    }
    _startedAtByBookingId.clear();
  }

  Duration? _durationFor(String bookingId) {
    final startedAt = _startedAtByBookingId[bookingId];
    if (startedAt == null) {
      return null;
    }
    final duration = _now().difference(startedAt);
    return duration.isNegative ? Duration.zero : duration;
  }

  Future<void> _recordClosed(String bookingId) {
    return _recordSafely(
      bookingId: bookingId,
      eventType: ProviderBookingDetailViewTelemetryEvent.closed,
      duration: _durationFor(bookingId),
    );
  }

  Future<void> _recordSafely({
    required String bookingId,
    required ProviderBookingDetailViewTelemetryEvent eventType,
    Duration? duration,
  }) async {
    try {
      await _record(
        bookingId: bookingId,
        eventType: eventType,
        duration: duration,
      );
    } catch (_) {
      // Telemetry must never block request review or partner job actions.
    }
  }
}
