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
}
