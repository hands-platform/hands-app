import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api_client.dart';
import '../../../core/providers.dart';

final customerReferralRepositoryProvider =
    Provider<CustomerReferralRepository>((ref) {
  return CustomerReferralRepository(ref.read(apiClientProvider));
});

class CustomerReferralRepository {
  const CustomerReferralRepository(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>> summary() async {
    final result = await _api.getJson('/customer/referrals/summary');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> issueCode() async {
    final result = await _api.postJson('/customer/referral-code', {});
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> claim(String code) async {
    final result = await _api.postJson('/customer/referrals/claim', {
      'code': code.trim().toUpperCase(),
      'installSource': 'customer-app',
      'platform': 'android',
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> invites({String? cursor, int limit = 20}) async {
    final path = Uri(
      path: '/customer/referrals/invites',
      queryParameters: {
        'limit': '$limit',
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      },
    ).toString();
    final result = await _api.getJson(path);
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> rewards({String? cursor, int limit = 20}) async {
    final path = Uri(
      path: '/customer/referrals/rewards',
      queryParameters: {
        'limit': '$limit',
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      },
    ).toString();
    final result = await _api.getJson(path);
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> requestCashout(String rewardId) async {
    final result = await _api.postJson(
      '/customer/referrals/rewards/${Uri.encodeComponent(rewardId)}/cashout',
      {},
    );
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }
}
