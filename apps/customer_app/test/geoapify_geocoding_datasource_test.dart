import 'dart:async';
import 'dart:convert';

import 'package:customer_app/src/features/map/data/datasources/geoapify_geocoding_datasource.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

void main() {
  test('returns empty results when query is too short', () async {
    final client = _FakeClient((_) {
      throw StateError('network should not be called for short queries');
    });
    final dataSource =
        GeoapifyGeocodingDataSource(apiKey: 'test-key', client: client);

    final results = await dataSource.search('a');
    final twoCharacterResults = await dataSource.search('ab');

    expect(results, isEmpty);
    expect(twoCharacterResults, isEmpty);
    expect(client.callCount, 0);
  });

  test('parses Geoapify results and caches repeated normalized queries',
      () async {
    final client = _FakeClient((request) {
      expect(request.url.host, 'api.geoapify.com');
      expect(request.url.queryParameters['filter'], 'countrycode:vn');
      expect(request.url.queryParameters['bias'], 'countrycode:vn');
      expect(request.url.queryParameters['lang'], 'vi');
      return http.Response(
        jsonEncode({
          'features': [
            {
              'properties': {
                'formatted': 'District 1, Ho Chi Minh City, Vietnam',
                'lat': 10.7769,
                'lon': '106.7009',
              },
            },
          ],
        }),
        200,
      );
    });
    final dataSource =
        GeoapifyGeocodingDataSource(apiKey: 'test-key', client: client);

    final first = await dataSource.search(' District 1 ');
    final second = await dataSource.search('district 1');

    expect(first, hasLength(1));
    expect(first.first.label, 'District 1, Ho Chi Minh City, Vietnam');
    expect(first.first.latitude, 10.7769);
    expect(first.first.longitude, 106.7009);
    expect(identical(first, second), isTrue);
    expect(client.callCount, 1);
  });

  test('throws when Geoapify returns a non-success status', () async {
    final client = _FakeClient((_) => http.Response('rate limited', 429));
    final dataSource =
        GeoapifyGeocodingDataSource(apiKey: 'test-key', client: client);

    expect(
      () => dataSource.search('Da Nang'),
      throwsA(isA<Exception>()),
    );
  });
}

class _FakeClient extends http.BaseClient {
  _FakeClient(this._handler);

  final FutureOr<http.Response> Function(http.BaseRequest request) _handler;
  int callCount = 0;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    callCount += 1;
    final response = await _handler(request);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      reasonPhrase: response.reasonPhrase,
      request: request,
    );
  }
}
