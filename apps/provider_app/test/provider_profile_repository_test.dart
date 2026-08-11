import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/core/realtime_socket.dart';
import 'package:provider_app/src/features/map/data/datasources/provider_device_location_datasource.dart';
import 'package:provider_app/src/features/provider_profile/data/datasources/provider_device_identity_datasource.dart';
import 'package:provider_app/src/features/provider_profile/data/repositories/provider_profile_repository_impl.dart';

void main() {
  test('rolls partner offline when goOnline cannot save a location', () async {
    final requests = <String>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);

    unawaited(
      server.forEach((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;

        if (request.method == 'GET' && request.uri.path == '/partner/me') {
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
      socket: RealtimeSocket(baseUrl: 'http://localhost:3000'),
      locationDataSource: _NoLocationDataSource(),
      deviceIdentityDataSource: const _FakeDeviceIdentityDataSource(),
    );

    await expectLater(
      repository.goOnline(),
      throwsA(isA<StateError>()),
    );

    expect(requests, [
      'POST /partner/device-session',
      'POST /partner/online',
      'GET /partner/me',
      'POST /partner/offline',
    ]);

    await server.close(force: true);
  });

  test('does not go online when admin blocked this device', () async {
    final requests = <String>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);

    unawaited(
      server.forEach((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({
          'blocked': true,
          'device': {
            'blockReason': 'Duplicate account review',
          },
        }));
        await request.response.close();
      }),
    );

    final repository = ProviderProfileRepositoryImpl(
      api: ApiClient(
        baseUrl: 'http://${server.address.host}:${server.port}',
        tokenRefreshMode: TokenRefreshMode.disabled,
      ),
      socket: RealtimeSocket(baseUrl: 'http://localhost:3000'),
      locationDataSource: _NoLocationDataSource(),
      deviceIdentityDataSource: const _FakeDeviceIdentityDataSource(),
    );

    await expectLater(
      repository.goOnline(),
      throwsA(
        isA<StateError>().having(
          (error) => error.message,
          'message',
          contains('Duplicate account review'),
        ),
      ),
    );

    expect(requests, ['POST /partner/device-session']);

    await server.close(force: true);
  });

  test('does not go online when admin blocked this partner account', () async {
    final requests = <String>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);

    unawaited(
      server.forEach((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({
          'blocked': true,
          'providerBlocked': true,
          'blockedScope': 'provider',
          'blockReason': 'Identity review failed',
        }));
        await request.response.close();
      }),
    );

    final repository = ProviderProfileRepositoryImpl(
      api: ApiClient(
        baseUrl: 'http://${server.address.host}:${server.port}',
        tokenRefreshMode: TokenRefreshMode.disabled,
      ),
      socket: RealtimeSocket(baseUrl: 'http://localhost:3000'),
      locationDataSource: _NoLocationDataSource(),
      deviceIdentityDataSource: const _FakeDeviceIdentityDataSource(),
    );

    await expectLater(
      repository.goOnline(),
      throwsA(
        isA<StateError>().having(
          (error) => error.message,
          'message',
          contains('Identity review failed'),
        ),
      ),
    );

    expect(requests, ['POST /partner/device-session']);

    await server.close(force: true);
  });

  test('goes online when shared device only requires a session check',
      () async {
    final requests = <String>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);

    unawaited(
      server.forEach((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;

        if (request.method == 'POST' &&
            request.uri.path == '/partner/device-session') {
          request.response.write(jsonEncode({
            'ok': true,
            'blocked': false,
            'sharedDeviceProfileCount': 1,
            'session': {
              'suspicious': true,
              'suspiciousReason':
                  'Device is already linked to 1 other partner profile(s).',
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
      socket: RealtimeSocket(baseUrl: 'http://localhost:3000'),
      locationDataSource: _VietnamLocationDataSource(),
      deviceIdentityDataSource: const _FakeDeviceIdentityDataSource(),
    );

    await repository.goOnline();

    expect(requests, [
      'POST /partner/device-session',
      'POST /partner/online',
      'POST /partner/location',
    ]);

    await server.close(force: true);
  });

  test('attaches action address text only when explicitly requested', () async {
    Map<String, dynamic>? locationRequestBody;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);

    unawaited(
      server.forEach((request) async {
        request.response.headers.contentType = ContentType.json;

        if (request.method == 'POST' &&
            request.uri.path == '/partner/location') {
          locationRequestBody =
              jsonDecode(await utf8.decoder.bind(request).join())
                  as Map<String, dynamic>;
        }

        request.response.write(jsonEncode({'ok': true}));
        await request.response.close();
      }),
    );

    final repository = ProviderProfileRepositoryImpl(
      api: ApiClient(
        baseUrl: 'http://${server.address.host}:${server.port}',
        tokenRefreshMode: TokenRefreshMode.disabled,
      ),
      socket: RealtimeSocket(baseUrl: 'http://localhost:3000'),
      locationDataSource: _VietnamAddressLocationDataSource(),
      deviceIdentityDataSource: const _FakeDeviceIdentityDataSource(),
    );

    final location = await repository.updateLocation(
      bookingId: 'booking-1',
      includeAddressText: true,
    );

    expect(location, {
      'lat': 10.7769,
      'lng': 106.7009,
      'addressText': 'District 1, Ho Chi Minh City',
    });
    expect(locationRequestBody, {
      'lat': 10.7769,
      'lng': 106.7009,
      'bookingId': 'booking-1',
      'addressText': 'District 1, Ho Chi Minh City',
    });

    await server.close(force: true);
  });

  test('loads and updates the seven-day partner working-hours contract',
      () async {
    Map<String, dynamic>? updateBody;
    final requests = <String>[];
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final workingHours = List.generate(
      7,
      (index) => <String, dynamic>{
        'weekday': index + 1,
        'enabled': index < 5,
        'startMinute': 540,
        'endMinute': 1080,
      },
    );

    unawaited(
      server.forEach((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;
        if (request.method == 'PUT') {
          updateBody = jsonDecode(await utf8.decoder.bind(request).join())
              as Map<String, dynamic>;
        }
        request.response.write(jsonEncode({
          'availabilityIntent': 'AVAILABLE',
          'workingHours': workingHours,
        }));
        await request.response.close();
      }),
    );

    final repository = ProviderProfileRepositoryImpl(
      api: ApiClient(
        baseUrl: 'http://${server.address.host}:${server.port}',
        tokenRefreshMode: TokenRefreshMode.disabled,
      ),
      socket: RealtimeSocket(baseUrl: 'http://localhost:3000'),
      locationDataSource: _NoLocationDataSource(),
      deviceIdentityDataSource: const _FakeDeviceIdentityDataSource(),
    );

    final current = await repository.availability();
    final updated = await repository.updateWorkingHours(workingHours);

    expect(current['availabilityIntent'], 'AVAILABLE');
    expect(updated['workingHours'], hasLength(7));
    expect(updateBody, {'workingHours': workingHours});
    expect(requests, [
      'GET /partner/availability',
      'PUT /partner/availability',
    ]);

    await server.close(force: true);
  });
}

class _NoLocationDataSource extends ProviderDeviceLocationDataSource {
  @override
  Future<Position?> currentPosition() async => null;
}

class _VietnamLocationDataSource extends ProviderDeviceLocationDataSource {
  @override
  Future<Position?> currentPosition() async {
    return Position(
      latitude: 10.7769,
      longitude: 106.7009,
      timestamp: DateTime.utc(2026),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

class _VietnamAddressLocationDataSource extends _VietnamLocationDataSource {
  @override
  Future<String?> addressTextForPosition(Position position) async {
    return ' District 1, Ho Chi Minh City ';
  }
}

class _FakeDeviceIdentityDataSource extends ProviderDeviceIdentityDataSource {
  const _FakeDeviceIdentityDataSource()
      : super(storage: const FlutterSecureStorage());

  @override
  Future<ProviderDeviceIdentity> currentIdentity() async {
    return const ProviderDeviceIdentity(
      deviceId: 'test-provider-device',
      platform: 'android',
      appVersion: 'test',
    );
  }
}
