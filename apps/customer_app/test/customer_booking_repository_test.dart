import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/realtime_socket.dart';
import 'package:customer_app/src/features/booking/data/repositories/customer_booking_repository_impl.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('create booking sends address snapshot inputs and joins booking room',
      () async {
    final api = _FakeApiClient(
      postResponse: {'id': 'booking-1'},
      getResponse: {
        'id': 'booking-1',
        'status': 'OPEN_MATCHING',
      },
    );
    final socket = _FakeRealtimeSocket();
    final repository = CustomerBookingRepositoryImpl(api, socket);

    final booking = await repository.createBooking(
      'service-foot-60',
      providerId: 'partner-1',
      couponCode: ' hands10 ',
      selectedLocationId: 'location-1',
      paymentMethod: 'MOMO',
      customerName: 'Demo Customer',
      customerPhone: '0865907184',
      addressLine: 'District 1, Ho Chi Minh City, Vietnam',
      lat: 10.7769,
      lng: 106.7009,
      currentLat: 10.7770,
      currentLng: 106.7010,
      currentLocationUpdatedAt: DateTime.utc(2026, 6, 1, 1, 2, 3),
    );

    expect(api.postPath, '/customer/bookings');
    expect(api.getPath, '/customer/bookings/booking-1');
    expect(socket.joinedBookingIds, ['booking-1']);
    expect(booking['id'], 'booking-1');

    expect(api.postBody['serviceId'], 'service-foot-60');
    expect(api.postBody['providerId'], 'partner-1');
    expect(api.postBody['selectedLocationId'], 'location-1');
    expect(api.postBody['couponCode'], 'HANDS10');
    expect(api.postBody['lat'], 10.7769);
    expect(api.postBody['lng'], 106.7009);
    expect(api.postBody['currentLat'], 10.7770);
    expect(api.postBody['currentLng'], 106.7010);
    expect(
      api.postBody['currentLocationUpdatedAt'],
      '2026-06-01T01:02:03.000Z',
    );
    expect(api.postBody['paymentMethod'], 'MOMO');
    expect(api.postBody['scheduledStartAt'], isNull);

    final address = api.postBody['address'] as Map<String, dynamic>;
    expect(address['name'], 'Demo Customer');
    expect(address['phone'], '0865907184');
    expect(address['line1'], 'District 1, Ho Chi Minh City, Vietnam');
  });

  test('lists only payment methods returned by the authenticated API',
      () async {
    final api = _FakeApiClient(
      postResponse: const {},
      getResponse: {
        'currency': 'VND',
        'defaultMethod': 'CASH',
        'methods': [
          {
            'method': 'CASH',
            'label': 'Cash',
            'requiresRedirect': false,
          },
          {
            'method': 'MOMO',
            'label': 'MoMo',
            'requiresRedirect': true,
          },
        ],
      },
    );
    final repository =
        CustomerBookingRepositoryImpl(api, _FakeRealtimeSocket());

    final methods = await repository.listPaymentMethods();

    expect(api.getPath, '/customer/payment-methods');
    expect(methods.map((item) => item.method), ['CASH', 'MOMO']);
    expect(methods.last.requiresRedirect, isTrue);
  });

  test('returns the booking inside the provider-selection event envelope',
      () async {
    final api = _FakeApiClient(
      postResponse: {
        'bookingId': 'booking-1',
        'event': 'booking.matched',
        'status': 'MATCHED',
        'booking': {
          'id': 'booking-1',
          'status': 'PROVIDER_ON_THE_WAY',
          'selectedProvider': {'id': 'partner-2'},
          'chatRoom': {'id': 'chat-1'},
          'services': [
            {'serviceId': 'service-1'}
          ],
          'payment': {'method': 'CASH', 'status': 'AUTHORIZED'},
        },
      },
      getResponse: const {},
    );
    final repository =
        CustomerBookingRepositoryImpl(api, _FakeRealtimeSocket());

    final booking = await repository.selectProvider(
      'booking-1',
      'partner-2',
    );

    expect(api.postPath, '/customer/bookings/booking-1/select-provider');
    expect(api.postBody, {'providerId': 'partner-2'});
    expect(booking['id'], 'booking-1');
    expect(booking['selectedProvider'], {'id': 'partner-2'});
    expect(booking['chatRoom'], {'id': 'chat-1'});
    expect(booking['services'], isNotEmpty);
    expect(booking['payment'], isNotNull);
    expect(booking, isNot(contains('booking')));
  });
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient({
    required this.postResponse,
    required this.getResponse,
  }) : super(baseUrl: 'http://test.local');

  final Map<String, dynamic> postResponse;
  final Map<String, dynamic> getResponse;
  String? postPath;
  String? getPath;
  Map<String, dynamic> postBody = {};

  @override
  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    postPath = path;
    postBody = Map<String, dynamic>.from(body);
    return postResponse;
  }

  @override
  Future<dynamic> getJson(String path) async {
    getPath = path;
    return getResponse;
  }
}

class _FakeRealtimeSocket extends RealtimeSocket {
  _FakeRealtimeSocket() : super(baseUrl: 'http://socket.test');

  final List<String> joinedBookingIds = [];

  @override
  void joinBooking(String bookingId) {
    joinedBookingIds.add(bookingId);
  }
}
