import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/core/realtime_socket.dart';
import 'package:provider_app/src/features/map/data/datasources/provider_device_location_datasource.dart';
import 'package:provider_app/src/features/provider_profile/data/repositories/provider_profile_repository_impl.dart';

void main() {
  test('rolls provider offline when goOnline cannot save a location',
      () async {
    final requests = <String>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);

    unawaited(
      server.forEach((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;

        if (request.method == 'GET' && request.uri.path == '/provider/me') {
          request.response.write(jsonEncode({
            'providerProfile': {
              'currentLat': null,
              'currentLng': null,
            },
          }));
        } else {
          request.response.write(jsonEncode({'ok': true}));
        }

        await request.response.close();
      }),
    );

    final repository = ProviderProfileRepositoryImpl(
      api: ApiClient(
        baseUrl: 'http://${server.address.host}:${server.port}',
        tokenRefreshMode: TokenRefreshMode.disabled,
      ),
      socket: RealtimeSocket(baseUrl: 'http://localhost:3100'),
      locationDataSource: _NoLocationDataSource(),
    );

    await expectLater(
      repository.goOnline(),
      throwsA(isA<StateError>()),
    );

    expect(requests, [
      'POST /provider/online',
      'GET /provider/me',
      'POST /provider/offline',
    ]);

    await server.close(force: true);
  });
}

class _NoLocationDataSource extends ProviderDeviceLocationDataSource {
  @override
  Future<Position?> currentPosition() async => null;
}
