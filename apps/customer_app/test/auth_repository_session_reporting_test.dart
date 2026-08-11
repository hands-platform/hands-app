import 'dart:async';

import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/app_session_reporter.dart';
import 'package:customer_app/src/core/realtime_socket.dart';
import 'package:customer_app/src/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:customer_app/src/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:customer_app/src/features/auth/data/models/auth_session_model.dart';
import 'package:customer_app/src/features/auth/data/models/otp_request_model.dart';
import 'package:customer_app/src/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  test(
      'OTP sign-in reports a customer session after activating the access token',
      () async {
    final api = _RecordingApiClient();
    final realtime = _RecordingRealtimeSocket();
    final repository = _buildRepository(api: api, realtime: realtime);

    final session = await repository.signInWithOtp(
      phone: '+84900000001',
      otp: '123456',
      role: 'CUSTOMER',
    );
    final sessionBody = await api.waitForSession();

    expect(session.userId, 'customer-user-1');
    expect(api.accessToken, 'access-token-1');
    expect(api.accessTokenWhenSessionReported, 'access-token-1');
    expect(realtime.connectedTokens, ['access-token-1']);
    expect(sessionBody['role'], 'CUSTOMER');
    expect(sessionBody['eventType'], 'SESSION_START');
    expect(
      sessionBody['clientEventId'],
      startsWith('hands-session-start-'),
    );
  });

  test('restoring a saved login also reports a customer session', () async {
    final initialApi = _RecordingApiClient();
    final initialRepository = _buildRepository(
      api: initialApi,
      realtime: _RecordingRealtimeSocket(),
    );
    await initialRepository.signInWithOtp(
      phone: '+84900000001',
      otp: '123456',
      role: 'CUSTOMER',
    );
    await initialApi.waitForSession();

    final restoredApi = _RecordingApiClient();
    final restoredRealtime = _RecordingRealtimeSocket();
    final restoredRepository = _buildRepository(
      api: restoredApi,
      realtime: restoredRealtime,
    );

    final restored = await restoredRepository.restoreSession();
    final sessionBody = await restoredApi.waitForSession();

    expect(restored?.userId, 'customer-user-1');
    expect(restoredApi.validatedPaths, ['/customer/me']);
    expect(restoredApi.accessTokenWhenSessionReported, 'access-token-1');
    expect(restoredRealtime.connectedTokens, ['access-token-1']);
    expect(sessionBody['eventType'], 'SESSION_START');
  });

  test('an unrecoverable customer session is cleared during restore', () async {
    final initialApi = _RecordingApiClient();
    final initialRepository = _buildRepository(
      api: initialApi,
      realtime: _RecordingRealtimeSocket(),
    );
    await initialRepository.signInWithOtp(
      phone: '+84900000001',
      otp: '123456',
      role: 'CUSTOMER',
    );
    await initialApi.waitForSession();

    final expiredApi = _ExpiredApiClient();
    final realtime = _RecordingRealtimeSocket();
    final restored = await _buildRepository(
      api: expiredApi,
      realtime: realtime,
    ).restoreSession();

    expect(restored, isNull);
    expect(expiredApi.accessToken, isNull);
    expect(expiredApi.refreshToken, isNull);
    expect(realtime.connectedTokens, isEmpty);
    expect(
      await const FlutterSecureStorage().read(key: 'test-auth-session'),
      isNull,
    );
  });

  test('profile updates replace and persist the authenticated user', () async {
    final api = _RecordingApiClient();
    final repository = _buildRepository(
      api: api,
      realtime: _RecordingRealtimeSocket(),
    );
    await repository.signInWithOtp(
      phone: '+84900000001',
      otp: '123456',
      role: 'CUSTOMER',
    );

    final updated = await repository.updateProfile(
      fullName: 'Hanh Nguyen',
      email: 'hanh@example.com',
    );
    final stored = await const AuthLocalDataSource(
      storage: FlutterSecureStorage(),
      storageKey: 'test-auth-session',
    ).readSession();

    expect(updated.user['fullName'], 'Hanh Nguyen');
    expect(stored?.user['email'], 'hanh@example.com');
  });
}

AuthRepositoryImpl _buildRepository({
  required _RecordingApiClient api,
  required _RecordingRealtimeSocket realtime,
}) {
  const storage = FlutterSecureStorage();
  return AuthRepositoryImpl(
    remoteDataSource: _FakeAuthRemoteDataSource(),
    localDataSource: const AuthLocalDataSource(
      storage: storage,
      storageKey: 'test-auth-session',
    ),
    apiClient: api,
    appSessionReporter: AppSessionReporter(
      api: api,
      addressStorageKey: 'test-address',
      storage: storage,
      role: 'CUSTOMER',
      storageKey: 'test-device',
    ),
    realtimeSocket: realtime,
  );
}

class _FakeAuthRemoteDataSource implements AuthRemoteDataSource {
  @override
  Future<OtpRequestModel> requestOtp({
    required String phone,
    required String role,
  }) async {
    return OtpRequestModel(
      phone: phone,
      role: role,
      status: 'OTP_REQUESTED',
    );
  }

  @override
  Future<AuthSessionModel> verifyOtp({
    required String phone,
    required String otp,
    required String role,
  }) async {
    return const AuthSessionModel(
      userId: 'customer-user-1',
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      user: {
        'id': 'customer-user-1',
        'phone': '+84900000001',
        'role': 'CUSTOMER',
      },
    );
  }
}

class _RecordingApiClient extends ApiClient {
  _RecordingApiClient() : super(baseUrl: 'http://test.local');

  final Completer<Map<String, dynamic>> _sessionReported =
      Completer<Map<String, dynamic>>();
  final List<String> validatedPaths = [];
  String? accessTokenWhenSessionReported;

  Future<Map<String, dynamic>> waitForSession() {
    return _sessionReported.future.timeout(const Duration(seconds: 2));
  }

  @override
  Future<dynamic> getJson(String path) async {
    validatedPaths.add(path);
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    expect(path, '/app/session');
    accessTokenWhenSessionReported = accessToken;
    if (!_sessionReported.isCompleted) {
      _sessionReported.complete(Map<String, dynamic>.from(body));
    }
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> patchJson(String path, Map<String, dynamic> body) async {
    expect(path, '/customer/me');
    return {
      'id': 'customer-user-1',
      'phone': '+84900000001',
      ...body,
    };
  }
}

class _ExpiredApiClient extends _RecordingApiClient {
  @override
  Future<dynamic> getJson(String path) async {
    validatedPaths.add(path);
    throw ApiException(401, const {'message': 'Invalid bearer token'});
  }
}

class _RecordingRealtimeSocket extends RealtimeSocket {
  _RecordingRealtimeSocket() : super(baseUrl: 'http://test.local');

  final List<String> connectedTokens = [];

  @override
  void connect(String accessToken) {
    connectedTokens.add(accessToken);
  }

  @override
  void dispose() {}
}
