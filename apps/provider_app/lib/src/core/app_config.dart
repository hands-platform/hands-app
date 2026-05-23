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
    defaultValue: 'http://localhost:3100/api',
  );

  static const socketBaseUrl = String.fromEnvironment(
    'SOCKET_BASE_URL',
    defaultValue: 'http://localhost:3100',
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
}
