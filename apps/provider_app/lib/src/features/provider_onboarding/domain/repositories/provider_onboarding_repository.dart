abstract class ProviderOnboardingRepository {
  Future<Map<String, dynamic>> snapshot();

  Future<Map<String, dynamic>> updateBasicProfile(Map<String, dynamic> input);

  Future<Map<String, dynamic>> submitKyc({
    String? cccdNumber,
    List<Map<String, String>> documents = const [],
  });

  Future<Map<String, dynamic>> createBankAccount({
    required String bankName,
    String? accountNumber,
    required String accountHolderName,
    Map<String, dynamic>? qrBankingInfo,
  });

  Future<Map<String, dynamic>> upsertTaxProfile({
    String? taxCode,
    required String legalName,
    required String registeredAddress,
  });

  Future<Map<String, dynamic>> acceptAgreement({
    required String type,
    required String version,
    String? deviceId,
  });
}
