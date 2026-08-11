import 'dart:convert';
import 'dart:io';

import 'package:customer_app/src/core/api_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('concurrent 401 responses share one refresh-token request', () async {
    var refreshRequestCount = 0;
    var authorizedRetryCount = 0;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);

    server.listen((request) async {
      if (request.uri.path == '/api/auth/refresh') {
        refreshRequestCount += 1;
        final body = jsonDecode(await utf8.decoder.bind(request).join());
        expect(body, {'refreshToken': 'old-refresh-token'});
        await Future<void>.delayed(const Duration(milliseconds: 100));
        await _respondJson(request.response, 200, {
          'accessToken': 'new-access-token',
          'refreshToken': 'new-refresh-token',
        });
        return;
      }

      await request.drain<void>();
      if (request.headers.value(HttpHeaders.authorizationHeader) ==
          'Bearer new-access-token') {
        authorizedRetryCount += 1;
        await _respondJson(request.response, 200, {
          'path': request.uri.path,
        });
        return;
      }

      await _respondJson(request.response, 401, {
        'message': 'Invalid bearer token',
      });
    });

    final api = ApiClient(
      baseUrl: 'http://${server.address.address}:${server.port}/api',
    )
      ..accessToken = 'expired-access-token'
      ..refreshToken = 'old-refresh-token';

    final results = await Future.wait([
      api.getJson('/first'),
      api.postJson('/second', {'value': 1}),
    ]);

    expect(refreshRequestCount, 1);
    expect(authorizedRetryCount, 2);
    expect(results, [
      {'path': '/api/first'},
      {'path': '/api/second'},
    ]);
    expect(api.accessToken, 'new-access-token');
    expect(api.refreshToken, 'new-refresh-token');
  });
}

Future<void> _respondJson(
  HttpResponse response,
  int statusCode,
  Map<String, dynamic> body,
) async {
  response.statusCode = statusCode;
  response.headers.contentType = ContentType.json;
  response.write(jsonEncode(body));
  await response.close();
}
