import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/features/booking/presentation/customer_booking_error_messages.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps service area booking gate errors', () {
    final message = customerBookingErrorMessage(
      ApiException(400, {'message': 'Booking address must be inside Vietnam'}),
    );

    expect(message, contains('outside the current HANDS service area'));
    expect(message, contains('browse partners from anywhere'));
  });

  test('maps missing current GPS booking gate errors', () {
    final message = customerBookingErrorMessage(
      ApiException(
        400,
        {
          'message':
              'Recent customer current location is required before booking'
        },
      ),
    );

    expect(message, contains('refresh your current GPS'));
  });

  test('maps stale current GPS booking gate errors', () {
    final message = customerBookingErrorMessage(
      ApiException(
        400,
        {
          'message':
              'Customer current location must be refreshed within 10 minutes before booking',
        },
      ),
    );

    expect(message, contains('too old'));
    expect(message, contains('Refresh your current location'));
  });

  test('maps customer distance booking gate errors', () {
    final message = customerBookingErrorMessage(
      ApiException(
        400,
        {
          'message':
              'Customer current location must be within 10km of the booking address',
        },
      ),
    );

    expect(message, contains('too far from the service address'));
    expect(message, contains('service pin'));
  });

  test('maps preferred partner distance booking gate errors', () {
    final message = customerBookingErrorMessage(
      ApiException(
        400,
        {
          'message':
              'Preferred partner must be within 10km of the booking address'
        },
      ),
    );

    expect(message, contains('too far from the service address'));
    expect(message, contains('first-pick booking'));
  });

  test('falls back to API message when no booking gate mapping exists', () {
    final message = customerBookingErrorMessage(
      ApiException(409, {'message': 'Coupon is no longer active'}),
    );

    expect(message, 'Coupon is no longer active');
  });

  test('hides raw ApiException strings when no API message is present', () {
    final message = customerBookingErrorMessage(ApiException(500, {}));

    expect(message, contains('Booking could not be created'));
    expect(message, isNot(contains('ApiException')));
  });
}
