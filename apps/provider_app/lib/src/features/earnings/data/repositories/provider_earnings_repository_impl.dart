import 'dart:convert';
import 'dart:math';

import '../../../../core/api_client.dart';
import '../../domain/repositories/provider_earnings_repository.dart';

class ProviderEarningsRepositoryImpl implements ProviderEarningsRepository {
  const ProviderEarningsRepositoryImpl(this._api);

  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> earningsSummary() async {
    final result = await _api.getJson('/partner/earnings/summary');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<List<dynamic>> earnings() async {
    final result = await _api.getJson('/partner/earnings');
    return result is List<dynamic> ? result : [];
  }

  @override
  Future<List<dynamic>> payoutBatches() async {
    final result = await _api.getJson('/partner/earnings/payout-batches');
    return result is List<dynamic> ? result : [];
  }

  @override
  Future<List<dynamic>> walletWithdrawalRequests() async {
    final result =
        await _api.getJson('/partner/earnings/wallet-withdrawal-requests');
    return result is List<dynamic> ? result : [];
  }

  @override
  Future<Map<String, dynamic>> createWalletWithdrawalRequest({
    required int amount,
    String? idempotencyKey,
    String? bankAccountId,
    String? requestNote,
  }) async {
    final requestKey = idempotencyKey ?? _withdrawalRequestKey();
    final result = await _api.postJson(
      '/partner/earnings/wallet-withdrawal-requests',
      {
        'idempotencyKey': requestKey,
        'amount': amount,
        if (bankAccountId != null) 'bankAccountId': bankAccountId,
        if (requestNote != null && requestNote.trim().isNotEmpty)
          'requestNote': requestNote.trim(),
      },
    );
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  String _withdrawalRequestKey() {
    final random = Random.secure();
    final bytes = List<int>.generate(18, (_) => random.nextInt(256));
    return 'withdrawal-${base64UrlEncode(bytes).replaceAll('=', '')}';
  }
}
