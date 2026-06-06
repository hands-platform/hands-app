import '../../../core/provider_value_helpers.dart';

double? providerChatCustomerLatitude(Map<String, dynamic>? booking) {
  return _bookingCoordinate(
    booking,
    legacyKey: 'lat',
    snapshotKey: 'latitude',
    snapshotLegacyKey: 'lat',
  );
}

double? providerChatCustomerLongitude(Map<String, dynamic>? booking) {
  return _bookingCoordinate(
    booking,
    legacyKey: 'lng',
    snapshotKey: 'longitude',
    snapshotLegacyKey: 'lng',
  );
}

double? _bookingCoordinate(
  Map<String, dynamic>? booking, {
  required String legacyKey,
  required String snapshotKey,
  required String snapshotLegacyKey,
}) {
  final direct = asNum(booking?[legacyKey])?.toDouble();
  if (direct != null) {
    return direct;
  }

  final snapshot = asMap(booking?['addressSnapshot']);
  final snapshotValue = asNum(snapshot?[snapshotKey])?.toDouble() ??
      asNum(snapshot?[snapshotLegacyKey])?.toDouble();
  if (snapshotValue != null) {
    return snapshotValue;
  }

  final nestedAddress = asMap(snapshot?['address']);
  return asNum(nestedAddress?[snapshotKey])?.toDouble() ??
      asNum(nestedAddress?[snapshotLegacyKey])?.toDouble();
}
