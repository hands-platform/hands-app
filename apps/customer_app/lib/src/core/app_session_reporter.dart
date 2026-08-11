import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'customer_marketing_attribution.dart';

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
    required String addressStorageKey,
    required FlutterSecureStorage storage,
    required String role,
    required String storageKey,
    CustomerMarketingAttributionStore? marketingAttributionStore,
  })  : _api = api,
        _addressStorageKey = addressStorageKey,
        _storage = storage,
        _role = role,
        _storageKey = storageKey,
        _marketingAttributionStore = marketingAttributionStore;

  final ApiClient _api;
  final String _addressStorageKey;
  final FlutterSecureStorage _storage;
  final String _role;
  final String _storageKey;
  final CustomerMarketingAttributionStore? _marketingAttributionStore;
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
    final metadata = await _marketingAttributionStore?.sessionMetadata();
    await _api.postJson('/app/session', {
      'role': _role,
      'deviceId': deviceId,
      'platform': defaultTargetPlatform.name,
      'appVersion': const String.fromEnvironment(
        'APP_VERSION',
        defaultValue: '0.1.0+1',
      ),
      'deviceLanguage': PlatformDispatcher.instance.locale.toLanguageTag(),
      'lastLoginAddress': await _readLastLoginAddress(),
      if (metadata != null) 'metadata': metadata,
      if (eventType != null) 'eventType': eventType,
      if (eventType != null) 'clientEventId': createClientEventId(eventType),
    });
  }

  Future<void> saveLastKnownAddress(String addressText) async {
    final normalized = addressText.trim();
    if (normalized.isEmpty) {
      return;
    }
    await _storage.write(key: _addressStorageKey, value: normalized);
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
        'hands-customer-${base64UrlEncode(bytes).replaceAll('=', '')}';
    await _storage.write(key: _storageKey, value: generated);
    _deviceId = generated;
    return generated;
  }

  Future<String?> _readLastLoginAddress() async {
    final saved = await _storage.read(key: _addressStorageKey);
    final normalized = saved?.trim();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }
}

void reportAppUsageFailure(Object error, StackTrace stackTrace) {
  if (kDebugMode) {
    debugPrint('App usage event failed: $error');
    debugPrintStack(stackTrace: stackTrace);
  }
}
