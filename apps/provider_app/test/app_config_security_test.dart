import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/app_config.dart';

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
        socketUrl: 'http://127.0.0.1:3000',
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

  test(
      'release configuration rejects Supabase auth without Supabase credentials',
      () {
    expect(
      () => AppConfig.validateReleaseConfiguration(
        releaseMode: true,
        apiUrl: 'https://api.hands.vn/api',
        socketUrl: 'https://api.hands.vn',
        configuredAuthBackend: 'supabase',
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
