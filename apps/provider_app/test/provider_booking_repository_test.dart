import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/core/realtime_socket.dart';
import 'package:provider_app/src/features/booking/data/repositories/provider_booking_repository_impl.dart';

void main() {
  test('cancelBooking posts the partner cancellation note', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    Map<String, dynamic>? requestBody;
    String? requestPath;
    server.listen((request) async {
      requestPath = request.uri.path;
      requestBody = jsonDecode(await utf8.decoder.bind(request).join())
          as Map<String, dynamic>;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({
        'id': 'booking-1',
        'postMatchCancellation': {
          'autoApproved': false,
          'adminReviewRequired': true,
        },
      }));
      await request.response.close();
    });

    final repository = ProviderBookingRepositoryImpl(
      ApiClient(baseUrl: 'http://127.0.0.1:${server.port}'),
      RealtimeSocket(baseUrl: 'http://127.0.0.1:${server.port}'),
    );

    final result = await repository.cancelBooking(
      'booking-1',
      note: 'Need to cancel after matching.',
    );

    expect(requestPath, '/partner/bookings/booking-1/cancel');
    expect(requestBody, {'note': 'Need to cancel after matching.'});
    expect(result['postMatchCancellation'], isA<Map<String, dynamic>>());
  });
}
