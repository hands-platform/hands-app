import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/local_demo_access.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/otp_request.dart';
import '../../domain/usecases/request_otp.dart';
import '../../domain/usecases/restore_auth_session.dart';
import '../../domain/usecases/sign_in_with_otp.dart';
import '../../domain/usecases/sign_out.dart';

class AuthController extends StateNotifier<AuthSession?> {
  AuthController({
    required RestoreAuthSession restoreAuthSession,
    required RequestOtp requestOtp,
    required SignInWithOtp signInWithOtp,
    required SignOut signOut,
  })  : _restoreAuthSession = restoreAuthSession,
        _requestOtp = requestOtp,
        _signInWithOtp = signInWithOtp,
        _signOut = signOut,
        super(null);

  final RestoreAuthSession _restoreAuthSession;
  final RequestOtp _requestOtp;
  final SignInWithOtp _signInWithOtp;
  final SignOut _signOut;

  Future<AuthSession?> restoreSession() async {
    if (state != null) {
      return state;
    }
    final session = await _restoreAuthSession();
    state = session;
    return session;
  }

  Future<OtpRequest> requestOtp({
    required String phone,
    String role = 'CUSTOMER',
  }) {
    return _requestOtp(phone: phone, role: role);
  }

  Future<OtpRequest> requestDemoCustomerOtp() {
    ensureLocalDemoAccessEnabled();
    return requestOtp(phone: '+84900000001');
  }

  Future<void> signInWithOtp({
    required String phone,
    required String otp,
    String role = 'CUSTOMER',
  }) async {
    state = await _signInWithOtp(phone: phone, otp: otp, role: role);
  }

  Future<void> signInDemoCustomer() async {
    ensureLocalDemoAccessEnabled();
    await signInWithOtp(
      phone: '+84900000001',
      otp: '123456',
    );
  }

  void replaceSession(AuthSession session) {
    state = session;
  }

  Future<void> signOut() async {
    await _signOut();
    state = null;
  }
}
