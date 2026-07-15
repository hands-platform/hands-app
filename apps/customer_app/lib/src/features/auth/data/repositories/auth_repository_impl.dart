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
    _activateSession(session);
    return session;
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
    await _localDataSource.clearSession();
    _activeSession = null;
    _apiClient.onTokensRefreshed = null;
    _apiClient.accessToken = null;
    _apiClient.refreshToken = null;
    _realtimeSocket.dispose();
  }

  void _activateSession(AuthSession session) {
    _activeSession = session;
    _apiClient.accessToken = session.accessToken;
    _apiClient.refreshToken = session.refreshToken;
    _apiClient.onTokensRefreshed = _persistRefreshedSession;
    _realtimeSocket.connect(session.accessToken);
    _recordAppSession();
  }

  void _recordAppSession() {
    _appSessionReporter.recordHeartbeat().catchError((_) {});
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
