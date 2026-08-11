abstract class ProviderEarningsRepository {
  Future<Map<String, dynamic>> earningsSummary();

  Future<List<dynamic>> earnings();

  Future<List<dynamic>> payoutBatches();

  Future<List<dynamic>> walletWithdrawalRequests();

  Future<Map<String, dynamic>> createWalletWithdrawalRequest({
    required int amount,
    String? bankAccountId,
    String? requestNote,
  });
}
