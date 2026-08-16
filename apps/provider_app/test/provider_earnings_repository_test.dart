import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/features/earnings/data/repositories/provider_earnings_repository_impl.dart';

void main() {
  test('lists and creates partner wallet withdrawal requests', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    final requests = <String>[];
    Map<String, dynamic>? createBody;
    server.listen((request) async {
      requests.add('${request.method} ${request.uri.path}');
      request.response.headers.contentType = ContentType.json;
      if (request.method == 'POST') {
        createBody = jsonDecode(await utf8.decoder.bind(request).join())
            as Map<String, dynamic>;
        request.response.write(jsonEncode({
          'id': 'withdrawal-1',
          'status': 'REQUESTED',
          ...createBody!,
        }));
      } else {
        request.response.write(jsonEncode([
          {'id': 'withdrawal-1', 'status': 'REQUESTED'}
        ]));
      }
      await request.response.close();
    });

    final repository = ProviderEarningsRepositoryImpl(
      ApiClient(baseUrl: 'http://127.0.0.1:${server.port}'),
    );

    expect(await repository.walletWithdrawalRequests(), [
      {'id': 'withdrawal-1', 'status': 'REQUESTED'}
    ]);
    expect(
      await repository.createWalletWithdrawalRequest(
        amount: 500000,
        idempotencyKey: 'withdrawal-request-test-1',
        bankAccountId: 'bank-1',
        requestNote: '  Monthly withdrawal  ',
      ),
      {
        'id': 'withdrawal-1',
        'status': 'REQUESTED',
        'idempotencyKey': 'withdrawal-request-test-1',
        'amount': 500000,
        'bankAccountId': 'bank-1',
        'requestNote': 'Monthly withdrawal',
      },
    );
    expect(requests, [
      'GET /partner/earnings/wallet-withdrawal-requests',
      'POST /partner/earnings/wallet-withdrawal-requests',
    ]);
    expect(createBody, {
      'idempotencyKey': 'withdrawal-request-test-1',
      'amount': 500000,
      'bankAccountId': 'bank-1',
      'requestNote': 'Monthly withdrawal',
    });
  });
}
