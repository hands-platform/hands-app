import '../../../../core/api_client.dart';
import '../../domain/repositories/provider_onboarding_repository.dart';

class ProviderOnboardingRepositoryImpl implements ProviderOnboardingRepository {
  const ProviderOnboardingRepositoryImpl({required ApiClient api}) : _api = api;

  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> snapshot() async {
    final result = await _api.getJson('/partner/onboarding');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> updateBasicProfile(
      Map<String, dynamic> input) async {
    final result =
        await _api.patchJson('/partner/onboarding/basic-profile', input);
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> submitKyc({
    String? cccdNumber,
    List<Map<String, String>> documents = const [],
  }) async {
    final result = await _api.postJson('/partner/onboarding/kyc/submit', {
      if (cccdNumber != null && cccdNumber.trim().isNotEmpty)
        'cccdNumber': cccdNumber,
      'documents': documents,
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> createBankAccount({
    required String bankName,
    String? accountNumber,
    required String accountHolderName,
    Map<String, dynamic>? qrBankingInfo,
  }) async {
    final result = await _api.postJson('/partner/onboarding/bank-accounts', {
      'bankName': bankName,
      if (accountNumber != null && accountNumber.trim().isNotEmpty)
        'accountNumber': accountNumber,
      'accountHolderName': accountHolderName,
      if (qrBankingInfo != null) 'qrBankingInfo': qrBankingInfo,
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> upsertTaxProfile({
    String? taxCode,
    required String legalName,
    required String registeredAddress,
  }) async {
    final result = await _api.postJson('/partner/onboarding/tax-profile', {
      if (taxCode != null && taxCode.trim().isNotEmpty) 'taxCode': taxCode,
      'legalName': legalName,
      'registeredAddress': registeredAddress,
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> acceptAgreement({
    required String type,
    required String version,
    String? deviceId,
  }) async {
    final result = await _api.postJson('/partner/onboarding/agreements', {
      'type': type,
      'version': version,
      if (deviceId != null && deviceId.trim().isNotEmpty) 'deviceId': deviceId,
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }
}
