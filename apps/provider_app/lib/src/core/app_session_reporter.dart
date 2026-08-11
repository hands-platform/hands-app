import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

const appOpenSessionWindow = Duration(minutes: 30);

bool shouldReportAppOpen({
  required DateTime now,
  DateTime? lastReportedAt,
}) {
  if (lastReportedAt == null) {
    return true;
  }
  final elapsed = now.difference(lastReportedAt);
  return elapsed.isNegative || elapsed >= appOpenSessionWindow;
}

class AppSessionReporter {
  AppSessionReporter({
    required ApiClient api,
    required FlutterSecureStorage storage,
    required String role,
    required String storageKey,
  })  : _api = api,
        _storage = storage,
        _role = role,
        _storageKey = storageKey;

  final ApiClient _api;
  final FlutterSecureStorage _storage;
  final String _role;
  final String _storageKey;
  String? _deviceId;
  Future<String>? _deviceIdLoad;

  Future<void> recordHeartbeat() => _recordSession();

  Future<void> recordSessionStart() => _recordSession('SESSION_START');

  Future<void> recordAppOpen() => _recordSession('APP_OPEN');

  String createClientEventId(String eventType) {
    final random = Random.secure();
    final bytes = List<int>.generate(18, (_) => random.nextInt(256));
    final suffix = base64UrlEncode(bytes).replaceAll('=', '');
    return 'hands-${eventType.toLowerCase().replaceAll('_', '-')}-$suffix';
  }

  Future<void> _recordSession([String? eventType]) async {
    final deviceId = await _readOrCreateDeviceId();
    await _api.postJson('/app/session', {
      'role': _role,
      'deviceId': deviceId,
      'platform': defaultTargetPlatform.name,
      'appVersion': const String.fromEnvironment(
        'APP_VERSION',
        defaultValue: '0.1.0+1',
      ),
      'deviceLanguage': PlatformDispatcher.instance.locale.toLanguageTag(),
      if (eventType != null) 'eventType': eventType,
      if (eventType != null) 'clientEventId': createClientEventId(eventType),
    });
  }

  Future<String> _readOrCreateDeviceId() async {
    final cached = _deviceId;
    if (cached != null) {
      return cached;
    }
    final pending = _deviceIdLoad;
    if (pending != null) {
      return pending;
    }

    final load = _loadOrCreateDeviceId();
    _deviceIdLoad = load;
    try {
      return await load;
    } finally {
      if (_deviceId == null) {
        _deviceIdLoad = null;
      }
    }
  }

  Future<String> _loadOrCreateDeviceId() async {
    final existing = await _storage.read(key: _storageKey);
    if (existing != null && existing.trim().isNotEmpty) {
      _deviceId = existing.trim();
      return _deviceId!;
    }

    final random = Random.secure();
    final bytes = List<int>.generate(18, (_) => random.nextInt(256));
    final generated =
        'hands-provider-${base64UrlEncode(bytes).replaceAll('=', '')}';
    await _storage.write(key: _storageKey, value: generated);
    _deviceId = generated;
    return generated;
  }
}

void reportAppUsageFailure(Object error, StackTrace stackTrace) {
  if (kDebugMode) {
    debugPrint('App usage event failed: $error');
    debugPrintStack(stackTrace: stackTrace);
  }
}
