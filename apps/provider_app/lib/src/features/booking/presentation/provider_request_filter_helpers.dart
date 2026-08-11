import '../../../core/provider_value_helpers.dart';
import 'provider_jobs_helpers.dart';

class ProviderRequestFilters {
  const ProviderRequestFilters({
    this.alertsEnabled = true,
    this.maxDistanceKm,
    this.customerGender,
    this.customerNationality,
    this.serviceId,
  });

  factory ProviderRequestFilters.fromJson(Map<String, dynamic> value) {
    final serviceIds = asList(value['serviceIds']);
    return ProviderRequestFilters(
      alertsEnabled: value['enabled'] != false,
      maxDistanceKm: asNum(value['maxDistanceKm'])?.toDouble(),
      customerGender: _text(value['customerGender']),
      customerNationality: _text(value['customerNationality']),
      serviceId: serviceIds.isEmpty ? null : _text(serviceIds.first),
    );
  }

  final bool alertsEnabled;
  final double? maxDistanceKm;
  final String? customerGender;
  final String? customerNationality;
  final String? serviceId;

  Map<String, dynamic> toJson() => {
        'enabled': alertsEnabled,
        'maxDistanceKm': maxDistanceKm,
        'customerGender': customerGender,
        'customerNationality': customerNationality,
        'serviceIds': serviceId == null ? <String>[] : [serviceId],
      };
}

bool providerBookingMatchesRequestFilters(
  Map<String, dynamic> booking,
  ProviderRequestFilters filters,
  String currentUserId,
) {
  if (providerIsPreferredRequest(booking, currentUserId)) return true;

  final distanceMeters = asNum(booking['distanceMeters'])?.toDouble();
  if (filters.maxDistanceKm != null &&
      (distanceMeters == null ||
          distanceMeters > filters.maxDistanceKm! * 1000)) {
    return false;
  }

  final customer = asMap(booking['customer']);
  if (!_matchesText(filters.customerGender, customer?['gender'])) return false;
  if (!_matchesText(filters.customerNationality, customer?['nationality'])) {
    return false;
  }

  if (filters.serviceId != null) {
    final services = asList(booking['services']);
    final matchesService = services.any(
      (item) =>
          asMap(asMap(item)?['service'])?['id']?.toString() ==
          filters.serviceId,
    );
    if (!matchesService) return false;
  }
  return true;
}

bool _matchesText(String? filter, Object? value) {
  if (filter == null) return true;
  return filter.toLowerCase() == _text(value)?.toLowerCase();
}

String? _text(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}
