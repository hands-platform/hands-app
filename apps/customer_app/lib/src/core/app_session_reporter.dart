import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

class AppSessionReporter {
  const AppSessionReporter({
    required ApiClient api,
    required String addressStorageKey,
    required FlutterSecureStorage storage,
    required String role,
    required String storageKey,
  })  : _api = api,
        _addressStorageKey = addressStorageKey,
        _storage = storage,
        _role = role,
        _storageKey = storageKey;

  final ApiClient _api;
  final String _addressStorageKey;
  final FlutterSecureStorage _storage;
  final String _role;
  final String _storageKey;

  Future<void> recordHeartbeat() async {
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
      'lastLoginAddress': await _readLastLoginAddress(),
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
    final existing = await _storage.read(key: _storageKey);
    if (existing != null && existing.trim().isNotEmpty) {
      return existing.trim();
    }

    final random = Random.secure();
    final bytes = List<int>.generate(18, (_) => random.nextInt(256));
    final generated =
        'hands-customer-${base64UrlEncode(bytes).replaceAll('=', '')}';
    await _storage.write(key: _storageKey, value: generated);
    return generated;
  }

  Future<String?> _readLastLoginAddress() async {
    final saved = await _storage.read(key: _addressStorageKey);
    final normalized = saved?.trim();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }
}
