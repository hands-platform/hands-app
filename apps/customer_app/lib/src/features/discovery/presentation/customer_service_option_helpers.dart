import '../../../core/customer_value_helpers.dart';

class CustomerServiceOptionGroup {
  const CustomerServiceOptionGroup({
    required this.key,
    required this.name,
    required this.options,
  });

  final String key;
  final String name;
  final List<Map<String, dynamic>> options;
}

Map<String, dynamic> customerBookableService(
  Map<String, dynamic> providerService,
) {
  final service = asMap(providerService['service']) ?? <String, dynamic>{};
  final providerPrice = asNum(providerService['price'])?.toInt();
  final basePrice = asNum(service['basePrice'])?.toInt() ?? 0;
  final effectivePrice = providerPrice ?? basePrice;

  return {
    ...service,
    'providerServiceId': providerService['id'],
    if (providerPrice != null) 'providerPrice': providerPrice,
    'effectivePrice': effectivePrice,
    'customerPrice': effectivePrice,
    'providerServiceActive': providerService['active'] ?? true,
  };
}

List<CustomerServiceOptionGroup> customerServiceOptionGroups(
  List<dynamic> providerServices, {
  String? requestedLocale,
}) {
  final grouped = <String, List<Map<String, dynamic>>>{};
  final names = <String, String>{};

  for (final item in providerServices) {
    final providerService = asMap(item);
    if (providerService == null) {
      continue;
    }

    final service = customerBookableService(providerService);
    if (!customerProviderServiceIsBookable(providerService, service)) {
      continue;
    }
    final key = customerServiceGroupKey(service);
    grouped.putIfAbsent(key, () => <Map<String, dynamic>>[]).add(service);
    names.putIfAbsent(
      key,
      () => customerServiceName(
        service,
        requestedLocale: requestedLocale,
      ),
    );
  }

  return grouped.entries.map((entry) {
    final options = [...entry.value]..sort((left, right) {
        final leftDuration = asNum(left['durationMin'])?.toInt() ?? 0;
        final rightDuration = asNum(right['durationMin'])?.toInt() ?? 0;
        final durationCompare = leftDuration.compareTo(rightDuration);
        if (durationCompare != 0) {
          return durationCompare;
        }
        return customerServicePrice(left)
            .compareTo(customerServicePrice(right));
      });

    return CustomerServiceOptionGroup(
      key: entry.key,
      name: names[entry.key] ?? 'Service',
      options: options,
    );
  }).toList();
}

String customerServiceGroupKey(Map<String, dynamic> service) {
  final groupKey = service['serviceGroupKey'];
  if (groupKey is String && groupKey.trim().isNotEmpty) {
    return groupKey.trim();
  }

  final slug = service['slug'];
  if (slug is String && slug.trim().isNotEmpty) {
    return slug.trim();
  }

  final name = service['name'];
  if (name is String && name.trim().isNotEmpty) {
    return name.trim().toLowerCase();
  }

  return service['id']?.toString() ?? 'service';
}

bool customerProviderServiceIsBookable(
  Map<String, dynamic> providerService,
  Map<String, dynamic> service,
) {
  if (providerService['active'] == false ||
      service['providerServiceActive'] == false) {
    return false;
  }

  final nestedService = asMap(providerService['service']);
  if (nestedService?['active'] == false) {
    return false;
  }

  if (nestedService == null) {
    return false;
  }

  final serverBookable = providerService['bookable'];
  if (serverBookable is bool) {
    return serverBookable;
  }

  final price = customerServicePrice(service);
  final basePrice = asNum(nestedService['basePrice'])?.toInt() ?? 0;
  final priceStep = asNum(nestedService['priceStep'])?.toInt() ?? 100000;
  if (price < basePrice || priceStep <= 0 || price % priceStep != 0) {
    return false;
  }

  final payoutRules = asList(nestedService['payoutRules']);
  return payoutRules.any((rule) {
    final mapped = asMap(rule);
    if (mapped == null || mapped['active'] == false) {
      return false;
    }
    return asNum(mapped['customerPrice'])?.toInt() == price;
  });
}

int customerServicePrice(Map<String, dynamic>? service) {
  if (service == null) {
    return 0;
  }
  return asNum(service['effectivePrice'])?.toInt() ??
      asNum(service['customerPrice'])?.toInt() ??
      asNum(service['providerPrice'])?.toInt() ??
      asNum(service['bookingPrice'])?.toInt() ??
      asNum(service['basePrice'])?.toInt() ??
      0;
}

String customerServiceOptionLabel(
  Map<String, dynamic>? service, {
  String? requestedLocale,
}) {
  if (service == null) {
    return 'Selected service';
  }
  final name = customerServiceName(
    service,
    requestedLocale: requestedLocale,
  );
  final duration = asNum(service['durationMin'])?.toInt();
  if (duration == null || duration <= 0) {
    return name;
  }
  return '$name / $duration min';
}

String customerServiceName(
  Map<String, dynamic>? service, {
  String? requestedLocale,
}) {
  final translations = asMap(service?['nameTranslations']);
  final requested = _normalizedServiceLocale(requestedLocale);
  for (final locale in <String?>[requested, 'vi', 'en']) {
    if (locale == null) continue;
    final translated = translations?[locale]?.toString().trim();
    if (translated != null && translated.isNotEmpty) {
      return translated;
    }
  }

  final legacyName = service?['name']?.toString().trim();
  return legacyName == null || legacyName.isEmpty
      ? 'Service unavailable'
      : legacyName;
}

String? _normalizedServiceLocale(String? locale) {
  final normalized = locale?.trim().toLowerCase().replaceAll('_', '-');
  if (normalized == null || normalized.isEmpty) return null;
  return normalized.split('-').first;
}

String customerServiceDurationLabel(Map<String, dynamic>? service) {
  final duration = asNum(service?['durationMin'])?.toInt();
  return duration == null || duration <= 0
      ? 'Duration not set'
      : '$duration min';
}

String customerServiceGroupDurationSummary(CustomerServiceOptionGroup group) {
  final durations = group.options
      .map((option) => asNum(option['durationMin'])?.toInt())
      .whereType<int>()
      .where((duration) => duration > 0)
      .toSet()
      .toList()
    ..sort();
  if (durations.isEmpty) {
    return '${group.options.length} option(s)';
  }
  return durations.map((duration) => '$duration min').join(' / ');
}

String customerServiceGroupPriceRangeLabel(CustomerServiceOptionGroup group) {
  final prices = group.options
      .map(customerServicePrice)
      .where((price) => price > 0)
      .toList()
    ..sort();
  if (prices.isEmpty) {
    return 'Price pending';
  }
  final lowest = prices.first;
  final highest = prices.last;
  if (lowest == highest) {
    return '${formatCurrency(lowest)} VND';
  }
  return '${formatCurrency(lowest)}-${formatCurrency(highest)} VND';
}

String customerServicePricePolicyLabel(Map<String, dynamic>? service) {
  if (service == null) {
    return 'Policy pending';
  }
  final price = customerServicePrice(service);
  final basePrice = asNum(service['basePrice'])?.toInt() ?? 0;
  final step = asNum(service['priceStep'])?.toInt() ?? 100000;
  if (price <= 0) {
    return 'Price pending';
  }
  if (basePrice > 0 && price < basePrice) {
    return 'Below minimum';
  }
  if (step > 0 && price % step != 0) {
    return 'Price step check';
  }
  if (basePrice > 0 && price > basePrice) {
    return 'Partner price';
  }
  return 'Admin minimum';
}

String customerServiceOptionPriceLabel(
  Map<String, dynamic>? service, {
  dynamic amount,
  String? requestedLocale,
}) {
  final price = asNum(amount)?.toInt() ?? customerServicePrice(service);
  return '${customerServiceOptionLabel(service, requestedLocale: requestedLocale)} / ${formatCurrency(price)} VND';
}
