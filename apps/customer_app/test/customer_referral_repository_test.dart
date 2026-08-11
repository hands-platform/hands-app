import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/features/referral/data/customer_referral_repository.dart';
import 'package:customer_app/src/features/referral/presentation/customer_referral_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses customer-scoped referral list and cashout endpoints', () async {
    final api = _RecordingApiClient();
    final repository = CustomerReferralRepository(api);

    await repository.invites(cursor: 'invite / 1', limit: 10);
    await repository.rewards(cursor: 'reward / 1', limit: 15);
    await repository.requestCashout('reward / 1');

    expect(
      api.getPaths,
      [
        '/customer/referrals/invites?limit=10&cursor=invite+%2F+1',
        '/customer/referrals/rewards?limit=15&cursor=reward+%2F+1',
      ],
    );
    expect(
      api.postPaths.single,
      '/customer/referrals/rewards/reward%20%2F%201/cashout',
    );
  });

  test('builds the public referral link from the server share path', () {
    expect(
      buildReferralShareUrl(
        baseUrl: 'https://hands.vn/base',
        sharePath: '/r/customer/HANDS123',
      ),
      'https://hands.vn/r/customer/HANDS123',
    );
  });
}

class _RecordingApiClient extends ApiClient {
  _RecordingApiClient() : super(baseUrl: 'http://test.local');

  final getPaths = <String>[];
  final postPaths = <String>[];

  @override
  Future<dynamic> getJson(String path) async {
    getPaths.add(path);
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    postPaths.add(path);
    return <String, dynamic>{};
  }
}
