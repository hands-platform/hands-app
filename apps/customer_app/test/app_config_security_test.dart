import 'package:customer_app/src/core/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('release configuration requires remote HTTPS API and socket endpoints',
      () {
    expect(
      () => AppConfig.validateReleaseConfiguration(
        releaseMode: true,
        apiUrl: 'http://localhost:3000/api',
        socketUrl: 'https://socket.hands.vn',
      ),
      throwsStateError,
    );
    expect(
      () => AppConfig.validateReleaseConfiguration(
        releaseMode: true,
        apiUrl: 'https://api.hands.vn/api',
        socketUrl: 'http://10.0.2.2:3000',
      ),
      throwsStateError,
    );
  });

  test('release configuration accepts secure remote endpoints', () {
    expect(
      () => AppConfig.validateReleaseConfiguration(
        releaseMode: true,
        apiUrl: 'https://api.hands.vn/api',
        socketUrl: 'https://api.hands.vn',
        configuredSupabaseUrl: 'https://project.supabase.co',
        configuredSupabaseAnonKey: 'sb_publishable_example',
        configuredAuthBackend: 'supabase',
      ),
      returnsNormally,
    );
  });

  test('release configuration rejects partial Supabase configuration', () {
    expect(
      () => AppConfig.validateReleaseConfiguration(
        releaseMode: true,
        apiUrl: 'https://api.hands.vn/api',
        socketUrl: 'https://api.hands.vn',
        configuredSupabaseUrl: 'https://project.supabase.co',
      ),
      throwsStateError,
    );
  });

  test('debug configuration keeps local development endpoints available', () {
    expect(
      () => AppConfig.validateReleaseConfiguration(
        releaseMode: false,
        apiUrl: 'http://localhost:3000/api',
        socketUrl: 'http://localhost:3000',
      ),
      returnsNormally,
    );
  });
}
