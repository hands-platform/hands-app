import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/booking/presentation/provider_request_filter_helpers.dart';

void main() {
  test('keeps direct requests visible and filters marketplace requests', () {
    const filters = ProviderRequestFilters(
      maxDistanceKm: 5,
      customerGender: 'female',
      customerNationality: 'Vietnamese',
      serviceId: 'service-1',
    );
    final marketplace = {
      'distanceMeters': 4200,
      'customer': {'gender': 'FEMALE', 'nationality': 'vietnamese'},
      'services': [
        {
          'service': {'id': 'service-1'}
        }
      ],
    };

    expect(
      providerBookingMatchesRequestFilters(marketplace, filters, 'user-1'),
      isTrue,
    );
    expect(
      providerBookingMatchesRequestFilters(
        {...marketplace, 'distanceMeters': 7000},
        filters,
        'user-1',
      ),
      isFalse,
    );
    expect(
      providerBookingMatchesRequestFilters(
        {...marketplace, 'isPreferredRequest': true},
        filters,
        'user-1',
      ),
      isTrue,
    );
  });
}
