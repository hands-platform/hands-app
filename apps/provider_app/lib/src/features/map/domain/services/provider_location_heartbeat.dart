import 'dart:async';

class ProviderLocationHeartbeatSnapshot {
  const ProviderLocationHeartbeatSnapshot({
    required this.active,
    this.lastAttemptAt,
    this.lastSuccessAt,
    this.nextUpdateAt,
    this.lastError,
    this.successCount = 0,
    this.failureCount = 0,
  });

  final bool active;
  final DateTime? lastAttemptAt;
  final DateTime? lastSuccessAt;
  final DateTime? nextUpdateAt;
  final Object? lastError;
  final int successCount;
  final int failureCount;

  ProviderLocationHeartbeatSnapshot copyWith({
    bool? active,
    DateTime? lastAttemptAt,
    DateTime? lastSuccessAt,
    DateTime? nextUpdateAt,
    Object? lastError,
    bool clearError = false,
    bool clearNextUpdateAt = false,
    int? successCount,
    int? failureCount,
  }) {
    return ProviderLocationHeartbeatSnapshot(
      active: active ?? this.active,
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
  ProviderLocationHeartbeat(this._updateLocation);

  static const interval = Duration(minutes: 10);

  final Future<void> Function() _updateLocation;
  final _snapshots =
      StreamController<ProviderLocationHeartbeatSnapshot>.broadcast(sync: true);
  Timer? _timer;
  ProviderLocationHeartbeatSnapshot _snapshot =
      const ProviderLocationHeartbeatSnapshot(active: false);

  ProviderLocationHeartbeatSnapshot get snapshot => _snapshot;
  Stream<ProviderLocationHeartbeatSnapshot> get snapshots => _snapshots.stream;

  Future<void> start({bool runImmediately = true}) async {
    _timer?.cancel();
    _setSnapshot(_snapshot.copyWith(
      active: true,
      nextUpdateAt: DateTime.now().add(interval),
    ));
    if (runImmediately) {
      await _runUpdate(rethrowErrors: true);
    }
    _timer = Timer.periodic(interval, (_) {
      unawaited(_runUpdate());
    });
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _setSnapshot(_snapshot.copyWith(
      active: false,
      clearNextUpdateAt: true,
    ));
  }

  void recordSuccessfulUpdate({DateTime? at}) {
    final succeededAt = at ?? DateTime.now();
    _setSnapshot(_snapshot.copyWith(
      active: true,
      lastAttemptAt: succeededAt,
      lastSuccessAt: succeededAt,
      nextUpdateAt: succeededAt.add(interval),
      clearError: true,
      successCount: _snapshot.successCount + 1,
    ));
  }

  void dispose() {
    stop();
    _snapshots.close();
  }

  Future<void> _runUpdate({bool rethrowErrors = false}) async {
    final attemptedAt = DateTime.now();
    _setSnapshot(_snapshot.copyWith(
      active: true,
      lastAttemptAt: attemptedAt,
      nextUpdateAt: attemptedAt.add(interval),
    ));

    try {
      await _updateLocation();
      recordSuccessfulUpdate();
    } catch (error) {
      final failedAt = DateTime.now();
      _setSnapshot(_snapshot.copyWith(
        active: true,
        nextUpdateAt: failedAt.add(interval),
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
