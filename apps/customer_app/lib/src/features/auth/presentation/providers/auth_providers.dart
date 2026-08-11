import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../../core/app_config.dart';
import '../../../../core/app_session_reporter.dart';
import '../../../../core/customer_marketing_attribution.dart';
import '../../../../core/providers.dart';
import '../../data/datasources/auth_local_datasource.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/datasources/nest_otp_auth_remote_datasource.dart';
import '../../data/datasources/supabase_otp_auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/usecases/request_otp.dart';
import '../../domain/usecases/restore_auth_session.dart';
import '../../domain/usecases/sign_in_with_otp.dart';
import '../../domain/usecases/sign_out.dart';
import '../controllers/auth_controller.dart';

export '../../domain/entities/auth_session.dart';
export '../controllers/auth_controller.dart';

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  if (AppConfig.authBackend == AuthBackend.supabase) {
    final client = ref.read(supabaseClientProvider);
    if (client == null) {
      throw StateError(
        'AUTH_BACKEND=supabase requires SUPABASE_URL and SUPABASE_ANON_KEY.',
      );
    }
    return SupabaseOtpAuthRemoteDataSource(client, ref.read(apiClientProvider));
  }

  return NestOtpAuthRemoteDataSource(ref.read(apiClientProvider));
});

final authLocalDataSourceProvider = Provider<AuthLocalDataSource>((ref) {
  return const AuthLocalDataSource(
    storage: FlutterSecureStorage(),
    storageKey: 'hands.customer.auth_session.v1',
  );
});

final appSessionReporterProvider = Provider<AppSessionReporter>((ref) {
  return AppSessionReporter(
    api: ref.read(apiClientProvider),
    addressStorageKey: 'hands.customer.last_login_address.v1',
    storage: const FlutterSecureStorage(),
    role: 'CUSTOMER',
    storageKey: 'hands.customer.app_session_device_id.v1',
    marketingAttributionStore: CustomerMarketingAttributionStore(
      storage: FlutterSecureStorage(),
    ),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    remoteDataSource: ref.read(authRemoteDataSourceProvider),
    localDataSource: ref.read(authLocalDataSourceProvider),
    apiClient: ref.read(apiClientProvider),
    appSessionReporter: ref.read(appSessionReporterProvider),
    realtimeSocket: ref.read(realtimeSocketProvider),
  );
});

final restoreAuthSessionProvider = Provider<RestoreAuthSession>((ref) {
  return RestoreAuthSession(ref.read(authRepositoryProvider));
});

final requestOtpProvider = Provider<RequestOtp>((ref) {
  return RequestOtp(ref.read(authRepositoryProvider));
});

final signInWithOtpProvider = Provider<SignInWithOtp>((ref) {
  return SignInWithOtp(ref.read(authRepositoryProvider));
});

final signOutProvider = Provider<SignOut>((ref) {
  return SignOut(ref.read(authRepositoryProvider));
});

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthSession?>((ref) {
  return AuthController(
    restoreAuthSession: ref.read(restoreAuthSessionProvider),
    requestOtp: ref.read(requestOtpProvider),
    signInWithOtp: ref.read(signInWithOtpProvider),
    signOut: ref.read(signOutProvider),
  );
});
