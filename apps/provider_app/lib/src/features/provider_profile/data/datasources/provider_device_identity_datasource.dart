import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ProviderDeviceIdentity {
  const ProviderDeviceIdentity({
    required this.deviceId,
    required this.platform,
    required this.appVersion,
  });

  final String deviceId;
  final String platform;
  final String appVersion;

  Map<String, dynamic> toJson() {
    return {
      'deviceId': deviceId,
      'platform': platform,
      'appVersion': appVersion,
    };
  }
}

class ProviderDeviceIdentityDataSource {
  const ProviderDeviceIdentityDataSource({
    required FlutterSecureStorage storage,
    String storageKey = 'hands.provider.device_id.v1',
  })  : _storage = storage,
        _storageKey = storageKey;

  final FlutterSecureStorage _storage;
  final String _storageKey;

  Future<ProviderDeviceIdentity> currentIdentity() async {
    final deviceId = await _readOrCreateDeviceId();
    return ProviderDeviceIdentity(
      deviceId: deviceId,
      platform: defaultTargetPlatform.name,
      appVersion: const String.fromEnvironment(
        'APP_VERSION',
        defaultValue: '0.1.0+1',
      ),
    );
  }

  Future<String> _readOrCreateDeviceId() async {
    final existing = await _storage.read(key: _storageKey);
    if (existing != null && existing.trim().isNotEmpty) {
      return existing.trim();
    }

    final generated = _generateDeviceId();
    await _storage.write(key: _storageKey, value: generated);
    return generated;
  }

  String _generateDeviceId() {
    final random = Random.secure();
    final bytes = List<int>.generate(18, (_) => random.nextInt(256));
    return 'hands-provider-${base64UrlEncode(bytes).replaceAll('=', '')}';
  }
}
