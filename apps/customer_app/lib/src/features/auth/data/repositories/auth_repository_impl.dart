import '../../../../core/api_client.dart';
import '../../../../core/app_session_reporter.dart';
import '../../../../core/realtime_socket.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/otp_request.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_datasource.dart';
import '../datasources/auth_remote_datasource.dart';
import '../models/auth_session_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthRemoteDataSource remoteDataSource,
    required AuthLocalDataSource localDataSource,
    required ApiClient apiClient,
    required AppSessionReporter appSessionReporter,
    required RealtimeSocket realtimeSocket,
  })  : _remoteDataSource = remoteDataSource,
        _localDataSource = localDataSource,
        _apiClient = apiClient,
        _appSessionReporter = appSessionReporter,
        _realtimeSocket = realtimeSocket;

  final AuthRemoteDataSource _remoteDataSource;
  final AuthLocalDataSource _localDataSource;
  final ApiClient _apiClient;
  final AppSessionReporter _appSessionReporter;
  final RealtimeSocket _realtimeSocket;
  AuthSession? _activeSession;

  @override
  Future<AuthSession?> restoreSession() async {
    final session = await _localDataSource.readSession();
    if (session == null) {
      return null;
    }
    _prepareSession(session);
    try {
      final result = await _apiClient.getJson('/customer/me');
      if (result is Map && result['id'] != null) {
        final refreshed = AuthSessionModel(
          userId: session.userId,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: Map<String, dynamic>.from(result),
        );
        _activeSession = refreshed;
        await _localDataSource.saveSession(refreshed);
        _connectAndRecordSession(refreshed);
        return refreshed;
      }
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        await _clearLocalSession();
        return null;
      }
    }
    _connectAndRecordSession(session);
    return session;
  }

  @override
  Future<AuthSession> updateProfile({
    required String fullName,
    required String email,
    String? gender,
    String? nationality,
  }) async {
    final session = _activeSession;
    if (session == null) {
      throw StateError('Sign in before updating the profile.');
    }
    final result = await _apiClient.patchJson('/customer/me', {
      'fullName': fullName.trim(),
      'email': email.trim(),
      if (gender != null) 'gender': gender,
      if (nationality != null) 'nationality': nationality.trim(),
    });
    if (result is! Map || result['id'] == null) {
      throw const FormatException('Profile update returned invalid user data.');
    }
    final updated = AuthSessionModel(
      userId: session.userId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: Map<String, dynamic>.from(result),
    );
    _activeSession = updated;
    await _localDataSource.saveSession(updated);
    return updated;
  }

  @override
  Future<OtpRequest> requestOtp({
    required String phone,
    required String role,
  }) {
    return _remoteDataSource.requestOtp(phone: phone, role: role);
  }

  @override
  Future<AuthSession> signInWithOtp({
    required String phone,
    required String otp,
    required String role,
  }) async {
    final session =
        await _remoteDataSource.verifyOtp(phone: phone, otp: otp, role: role);
    await _localDataSource.saveSession(session);
    _activateSession(session);
    return session;
  }

  @override
  Future<void> signOut() async {
    try {
      await _apiClient.revokeRefreshToken();
    } catch (_) {
      // Local sign-out must still complete when the API is unavailable.
    }
    await _clearLocalSession();
  }

  Future<void> _clearLocalSession() async {
    await _localDataSource.clearSession();
    _activeSession = null;
    _apiClient.onTokensRefreshed = null;
    _apiClient.accessToken = null;
    _apiClient.refreshToken = null;
    _realtimeSocket.dispose();
  }

  void _activateSession(AuthSession session) {
    _prepareSession(session);
    _connectAndRecordSession(session);
  }

  void _prepareSession(AuthSession session) {
    _activeSession = session;
    _apiClient.accessToken = session.accessToken;
    _apiClient.refreshToken = session.refreshToken;
    _apiClient.onTokensRefreshed = _persistRefreshedSession;
  }

  void _connectAndRecordSession(AuthSession session) {
    _realtimeSocket.connect(session.accessToken);
    _recordAppSession();
  }

  void _recordAppSession() {
    _appSessionReporter.recordSessionStart().catchError(reportAppUsageFailure);
  }

  Future<void> _persistRefreshedSession(
    String accessToken,
    String refreshToken,
  ) async {
    final session = _activeSession;
    if (session == null) {
      return;
    }
    final refreshed = AuthSessionModel(
      userId: session.userId,
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: session.user,
    );
    _activeSession = refreshed;
    await _localDataSource.saveSession(refreshed);
    _realtimeSocket.connect(accessToken);
  }
}
