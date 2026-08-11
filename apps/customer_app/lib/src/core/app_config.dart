import 'package:flutter/foundation.dart';

enum AuthBackend {
  nest,
  supabase,
}

class AppConfig {
  static const mapTilerApiKey = String.fromEnvironment(
    'MAPTILER_API_KEY',
    defaultValue: '',
  );

  static bool get mapTilerEnabled => mapTilerApiKey.isNotEmpty;

  static String get mapTilerStyleUrl =>
      'https://api.maptiler.com/maps/streets-v2/style.json?key=$mapTilerApiKey';

  static const geoapifyApiKey = String.fromEnvironment(
    'GEOAPIFY_API_KEY',
    defaultValue: '',
  );

  static bool get geoapifyEnabled => geoapifyApiKey.isNotEmpty;

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api',
  );

  static const socketBaseUrl = String.fromEnvironment(
    'SOCKET_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const supportEmail = String.fromEnvironment(
    'SUPPORT_EMAIL',
    defaultValue: 'administration@hands.vn',
  );

  static const referralPublicBaseUrl = String.fromEnvironment(
    'REFERRAL_PUBLIC_BASE_URL',
    defaultValue: 'https://hands.vn',
  );

  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '',
  );

  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  static bool get supabaseEnabled =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  static const authBackendValue = String.fromEnvironment(
    'AUTH_BACKEND',
    defaultValue: 'nest',
  );

  static AuthBackend get authBackend {
    if (authBackendValue == 'supabase') {
      return AuthBackend.supabase;
    }
    return AuthBackend.nest;
  }

  static void validateForCurrentBuild() {
    validateReleaseConfiguration(
      releaseMode: kReleaseMode,
      apiUrl: apiBaseUrl,
      socketUrl: socketBaseUrl,
      configuredSupabaseUrl: supabaseUrl,
      configuredSupabaseAnonKey: supabaseAnonKey,
      configuredAuthBackend: authBackendValue,
    );
  }

  @visibleForTesting
  static void validateReleaseConfiguration({
    required bool releaseMode,
    required String apiUrl,
    required String socketUrl,
    String configuredSupabaseUrl = '',
    String configuredSupabaseAnonKey = '',
    String configuredAuthBackend = 'nest',
  }) {
    if (!releaseMode) {
      return;
    }

    _requireSecureRemoteEndpoint('API_BASE_URL', apiUrl);
    _requireSecureRemoteEndpoint('SOCKET_BASE_URL', socketUrl);

    final hasSupabaseUrl = configuredSupabaseUrl.trim().isNotEmpty;
    final hasSupabaseKey = configuredSupabaseAnonKey.trim().isNotEmpty;
    if (hasSupabaseUrl != hasSupabaseKey) {
      throw StateError(
        'SUPABASE_URL and SUPABASE_ANON_KEY must be configured together in release builds.',
      );
    }
    if (hasSupabaseUrl) {
      _requireSecureRemoteEndpoint('SUPABASE_URL', configuredSupabaseUrl);
    }
    if (configuredAuthBackend == 'supabase' && !hasSupabaseUrl) {
      throw StateError(
        'AUTH_BACKEND=supabase requires Supabase URL and publishable key configuration.',
      );
    }
  }

  static void _requireSecureRemoteEndpoint(String name, String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
      throw StateError(
          '$name must use a valid HTTPS endpoint in release builds.');
    }

    final host = uri.host.toLowerCase();
    if (_isLocalHost(host)) {
      throw StateError(
          '$name cannot target a local address in release builds.');
    }
  }

  static bool _isLocalHost(String host) {
    return host == 'localhost' ||
        host == '0.0.0.0' ||
        host == '::1' ||
        host == '10.0.2.2' ||
        host.startsWith('127.');
  }
}
