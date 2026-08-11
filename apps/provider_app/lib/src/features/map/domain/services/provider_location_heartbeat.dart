import 'dart:async';

class ProviderLocationHeartbeatSnapshot {
  const ProviderLocationHeartbeatSnapshot({
    required this.active,
    this.interval = ProviderLocationHeartbeat.interval,
    this.bookingId,
    this.lastAttemptAt,
    this.lastSuccessAt,
    this.nextUpdateAt,
    this.lastError,
    this.successCount = 0,
    this.failureCount = 0,
  });

  final bool active;
  final Duration interval;
  final String? bookingId;
  final DateTime? lastAttemptAt;
  final DateTime? lastSuccessAt;
  final DateTime? nextUpdateAt;
  final Object? lastError;
  final int successCount;
  final int failureCount;

  ProviderLocationHeartbeatSnapshot copyWith({
    bool? active,
    Duration? interval,
    String? bookingId,
    DateTime? lastAttemptAt,
    DateTime? lastSuccessAt,
    DateTime? nextUpdateAt,
    Object? lastError,
    bool clearError = false,
    bool clearBookingId = false,
    bool clearNextUpdateAt = false,
    int? successCount,
    int? failureCount,
  }) {
    return ProviderLocationHeartbeatSnapshot(
      active: active ?? this.active,
      interval: interval ?? this.interval,
      bookingId: clearBookingId ? null : bookingId ?? this.bookingId,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      lastSuccessAt: lastSuccessAt ?? this.lastSuccessAt,
      nextUpdateAt:
          clearNextUpdateAt ? null : nextUpdateAt ?? this.nextUpdateAt,
      lastError: clearError ? null : lastError ?? this.lastError,
      successCount: successCount ?? this.successCount,
      failureCount: failureCount ?? this.failureCount,
    );
  }
}

class ProviderLocationHeartbeat {
  ProviderLocationHeartbeat(
    this._updateLocation, {
    Future<void> Function(String bookingId)? updateBookingLocation,
  }) : _updateBookingLocation = updateBookingLocation;

  static const interval = Duration(minutes: 60);
  static const activeBookingInterval = Duration(minutes: 30);

  final Future<void> Function() _updateLocation;
  final Future<void> Function(String bookingId)? _updateBookingLocation;
  final _snapshots =
      StreamController<ProviderLocationHeartbeatSnapshot>.broadcast(sync: true);
  Timer? _timer;
  ProviderLocationHeartbeatSnapshot _snapshot =
      const ProviderLocationHeartbeatSnapshot(active: false);

  ProviderLocationHeartbeatSnapshot get snapshot => _snapshot;
  Stream<ProviderLocationHeartbeatSnapshot> get snapshots => _snapshots.stream;

  Future<bool> syncForAvailability(
    Map<String, dynamic> availability, {
    bool runImmediately = true,
  }) async {
    if (!providerAvailabilityWantsLocationHeartbeat(availability)) {
      stop();
      return false;
    }

    if (_snapshot.active) {
      if (runImmediately) {
        await _runUpdate(
          rethrowErrors: true,
          interval: _snapshot.interval,
          bookingId: _snapshot.bookingId,
        );
      }
      return true;
    }

    await start(runImmediately: runImmediately);
    return true;
  }

  Future<void> start({
    bool runImmediately = true,
    Duration interval = ProviderLocationHeartbeat.interval,
    String? bookingId,
  }) async {
    _timer?.cancel();
    _setSnapshot(_snapshot.copyWith(
      active: true,
      interval: interval,
      bookingId: bookingId,
      clearBookingId: bookingId == null,
      nextUpdateAt: DateTime.now().add(interval),
    ));
    if (runImmediately) {
      await _runUpdate(
        rethrowErrors: true,
        interval: interval,
        bookingId: bookingId,
      );
    }
    _timer = Timer.periodic(interval, (_) {
      unawaited(_runUpdate(interval: interval, bookingId: bookingId));
    });
  }

  Future<void> startActiveBooking(
    String bookingId, {
    bool runImmediately = true,
  }) {
    return start(
      runImmediately: runImmediately,
      interval: activeBookingInterval,
      bookingId: bookingId,
    );
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _setSnapshot(_snapshot.copyWith(
      active: false,
      clearNextUpdateAt: true,
    ));
  }

  void recordSuccessfulUpdate({
    DateTime? at,
    Duration? interval,
    String? bookingId,
  }) {
    final succeededAt = at ?? DateTime.now();
    final nextInterval = interval ?? _snapshot.interval;
    _setSnapshot(_snapshot.copyWith(
      active: true,
      interval: nextInterval,
      bookingId: bookingId,
      lastAttemptAt: succeededAt,
      lastSuccessAt: succeededAt,
      nextUpdateAt: succeededAt.add(nextInterval),
      clearError: true,
      successCount: _snapshot.successCount + 1,
    ));
  }

  void dispose() {
    stop();
    _snapshots.close();
  }

  Future<void> _runUpdate({
    bool rethrowErrors = false,
    Duration? interval,
    String? bookingId,
  }) async {
    final attemptedAt = DateTime.now();
    final nextInterval = interval ?? _snapshot.interval;
    _setSnapshot(_snapshot.copyWith(
      active: true,
      interval: nextInterval,
      bookingId: bookingId,
      lastAttemptAt: attemptedAt,
      nextUpdateAt: attemptedAt.add(nextInterval),
    ));

    try {
      final updateBookingLocation = _updateBookingLocation;
      if (bookingId != null && updateBookingLocation != null) {
        await updateBookingLocation(bookingId);
      } else {
        await _updateLocation();
      }
      recordSuccessfulUpdate(interval: nextInterval, bookingId: bookingId);
    } catch (error) {
      final failedAt = DateTime.now();
      _setSnapshot(_snapshot.copyWith(
        active: true,
        interval: nextInterval,
        bookingId: bookingId,
        nextUpdateAt: failedAt.add(nextInterval),
        lastError: error,
        failureCount: _snapshot.failureCount + 1,
      ));
      if (rethrowErrors) {
        rethrow;
      }
    }
  }

  void _setSnapshot(ProviderLocationHeartbeatSnapshot next) {
    _snapshot = next;
    if (!_snapshots.isClosed) {
      _snapshots.add(next);
    }
  }
}

bool providerAvailabilityWantsLocationHeartbeat(
  Map<String, dynamic> availability,
) {
  return availability['availabilityIntent']?.toString() == 'AVAILABLE';
}

bool providerAvailabilityIsOnline(Map<String, dynamic> availability) {
  return const {
    'ONLINE_AVAILABLE',
    'ONLINE_AVAILABLE_SOON',
    'ONLINE_BUSY',
  }.contains(availability['status']?.toString());
}
