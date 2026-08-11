import '../../../core/api_client.dart';

String customerBookingErrorMessage(Object exception) {
  final message = _apiMessage(exception);
  final normalized = message.toLowerCase();

  if (normalized.contains('booking address must be inside vietnam')) {
    return 'This address is outside the current HANDS service area. You can browse partners from anywhere, but booking must use a Vietnam service address.';
  }
  if (normalized.contains('recent customer current location is required') ||
      normalized.contains('current location timestamp is required')) {
    return 'Please confirm the service address again. Current GPS is optional, but the booking address must be clear.';
  }
  if (normalized.contains('current location timestamp is invalid')) {
    return 'The optional GPS evidence was invalid. Confirm the service address again and retry.';
  }
  if (normalized.contains('current location must be refreshed within')) {
    return 'The optional GPS evidence is old. You can still book from a confirmed Vietnam service address.';
  }
  if (normalized.contains('customer current location must be within') ||
      (normalized.contains('booking address must be within') &&
          normalized.contains('current location'))) {
    return 'You can browse partners from anywhere, but booking requires your current location to be within 50km of the selected service address.';
  }
  if (normalized.contains('preferred partner must be within')) {
    return 'This partner is too far from the service address for first-pick booking. Choose a closer partner or adjust the service address.';
  }
  if (normalized.contains('booking address text is required')) {
    return 'Please enter or confirm the service address before booking.';
  }
  if (normalized.contains('selected customer location was not found')) {
    return 'Please choose the service location again before booking.';
  }
  if (normalized.contains('partner does not offer this service')) {
    return 'This partner does not currently offer the selected service. Choose another service or partner.';
  }
  if (normalized.contains('partner verification is not approved') ||
      normalized.contains('partner is not available') ||
      normalized.contains('verification is not approved') ||
      normalized.contains('is not available')) {
    return 'This partner is not available for booking right now. Please choose another partner.';
  }

  if (message.isNotEmpty && !message.startsWith('ApiException(')) {
    return message;
  }
  return 'Booking could not be created. Please check the address and try again.';
}

Map<String, dynamic>? customerLatestBookingFromError(Object exception) {
  if (exception is! ApiException) {
    return null;
  }
  final booking = exception.body['booking'];
  return booking is Map ? Map<String, dynamic>.from(booking) : null;
}

String _apiMessage(Object exception) {
  if (exception is ApiException) {
    final message = exception.body['message'];
    if (message is String) {
      return message;
    }
    if (message is List) {
      return message.whereType<String>().join(' ');
    }
    final error = exception.body['error'];
    if (error is String) {
      return error;
    }
  }
  return exception.toString();
}
