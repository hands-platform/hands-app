import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/features/provider_onboarding/data/repositories/provider_onboarding_repository_impl.dart';

void main() {
  test('uses onboarding API without leaking calls into presentation', () async {
    final requests = <String>[];
    final bodies = <Map<String, dynamic>>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);

    unawaited(
      server.forEach((request) async {
        requests.add('${request.method} ${request.uri.path}');
        if (request.method != 'GET') {
          final body = await utf8.decoder.bind(request).join();
          bodies.add(jsonDecode(body) as Map<String, dynamic>);
        }
        request.response.headers.contentType = ContentType.json;

        switch ('${request.method} ${request.uri.path}') {
          case 'GET /partner/onboarding':
            request.response.write(jsonEncode({
              'level': 'LEVEL_1_SIGNUP',
              'nextRequiredActions': ['BASIC_PROFILE'],
            }));
          case 'PATCH /partner/onboarding/basic-profile':
            request.response.write(jsonEncode({'ok': true}));
          case 'POST /partner/onboarding/bank-accounts':
            request.response.write(jsonEncode({'ok': true}));
          case 'POST /partner/onboarding/tax-profile':
            request.response.write(jsonEncode({'ok': true}));
          case 'POST /partner/onboarding/agreements':
            request.response.write(jsonEncode({'ok': true}));
          case 'POST /partner/onboarding/kyc/submit':
            request.response.write(jsonEncode({'ok': true}));
          default:
            request.response.statusCode = 404;
            request.response.write(jsonEncode({'error': 'not found'}));
        }

        await request.response.close();
      }),
    );

    final repository = ProviderOnboardingRepositoryImpl(
      api: ApiClient(
        baseUrl: 'http://${server.address.host}:${server.port}',
        tokenRefreshMode: TokenRefreshMode.disabled,
      ),
    );

    final snapshot = await repository.snapshot();
    await repository.updateBasicProfile({'displayName': 'Linh Wellness'});
    await repository.createBankAccount(
      bankName: 'Vietcombank',
      accountHolderName: 'Demo Provider',
    );
    await repository.upsertTaxProfile(
      legalName: 'Demo Provider',
      registeredAddress: 'District 1, Ho Chi Minh City',
    );
    await repository.acceptAgreement(type: 'TERMS', version: '2026-05');
    await repository.submitKyc(cccdNumber: '000000000000');

    expect(snapshot['level'], 'LEVEL_1_SIGNUP');
    expect(requests, [
      'GET /partner/onboarding',
      'PATCH /partner/onboarding/basic-profile',
      'POST /partner/onboarding/bank-accounts',
      'POST /partner/onboarding/tax-profile',
      'POST /partner/onboarding/agreements',
      'POST /partner/onboarding/kyc/submit',
    ]);
    expect(bodies.first['displayName'], 'Linh Wellness');
    expect(bodies.last['cccdNumber'], '000000000000');

    await server.close(force: true);
  });
}
