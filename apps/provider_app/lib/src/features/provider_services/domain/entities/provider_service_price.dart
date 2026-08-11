class ProviderServicePrice {
  const ProviderServicePrice({
    required this.id,
    required this.name,
    required this.durationMin,
    required this.basePrice,
    required this.priceStep,
    required this.effectivePrice,
    required this.active,
    required this.payoutRuleConfigured,
    this.serviceGroupKey,
    this.description,
    this.providerPrice,
    this.providerPayoutAmount,
    this.platformFee,
    this.vatBps,
    this.otherCostAmount,
    this.currency = 'VND',
    this.payoutOptions = const [],
  });

  final String id;
  final String? serviceGroupKey;
  final String name;
  final String? description;
  final int durationMin;
  final int basePrice;
  final int priceStep;
  final int? providerPrice;
  final int effectivePrice;
  final bool active;
  final bool payoutRuleConfigured;
  final int? providerPayoutAmount;
  final int? platformFee;
  final int? vatBps;
  final int? otherCostAmount;
  final String currency;
  final List<ProviderServicePayoutOption> payoutOptions;

  bool get usesAdminMinimum =>
      providerPrice == null || providerPrice == basePrice;

  List<ProviderServicePayoutOption> get bookablePayoutOptions {
    final options = payoutOptions
        .where(
          (option) =>
              option.customerPrice >= basePrice &&
              priceStep > 0 &&
              option.customerPrice % priceStep == 0,
        )
        .toList()
      ..sort(
          (left, right) => left.customerPrice.compareTo(right.customerPrice));
    return List.unmodifiable(options);
  }

  ProviderServicePayoutOption? get lowestBookablePayoutOption {
    final options = bookablePayoutOptions;
    return options.isEmpty ? null : options.first;
  }

  int? get recommendedCustomerPrice => canActivateAtCurrentPrice
      ? effectivePrice
      : lowestBookablePayoutOption?.customerPrice;

  bool get currentPriceBelowMinimum => effectivePrice < basePrice;

  bool get currentPriceOffStep =>
      priceStep <= 0 || effectivePrice % priceStep != 0;

  bool get canActivateAtCurrentPrice =>
      !currentPriceBelowMinimum &&
      !currentPriceOffStep &&
      (payoutRuleConfigured || hasPayoutOptionForPrice(effectivePrice));

  bool get hasBookablePriceOptions => bookablePayoutOptions.isNotEmpty;

  int get estimatedVatAmount {
    final fee = platformFee ?? 0;
    final bps = vatBps ?? 0;
    return ((fee * bps) / 10000).round();
  }

  int get estimatedCompanyFeeAfterCosts {
    final fee = platformFee ?? 0;
    return fee - estimatedVatAmount - (otherCostAmount ?? 0);
  }

  ProviderServicePayoutOption? payoutOptionForPrice(int customerPrice) {
    for (final option in payoutOptions) {
      if (option.customerPrice == customerPrice) {
        return option;
      }
    }
    return null;
  }

  bool hasPayoutOptionForPrice(int customerPrice) =>
      payoutOptionForPrice(customerPrice) != null;

  ProviderServicePayoutOption? bookablePayoutOptionForPrice(
    int customerPrice,
  ) {
    for (final option in bookablePayoutOptions) {
      if (option.customerPrice == customerPrice) {
        return option;
      }
    }
    return null;
  }

  String? validationMessageForPrice(
    int? customerPrice, {
    required bool active,
  }) {
    if (customerPrice == null) {
      return 'Vui lòng nhập số tiền VND hợp lệ.';
    }
    if (customerPrice < basePrice) {
      return 'Giá phải từ mức tối thiểu của HANDS.';
    }
    if (priceStep <= 0 || customerPrice % priceStep != 0) {
      return 'Giá phải theo bước VND đã cấu hình.';
    }
    if (active && bookablePayoutOptionForPrice(customerPrice) == null) {
      return hasBookablePriceOptions
          ? 'Dịch vụ đang bật cần quy tắc chi trả chính xác cho mức giá này.'
          : 'HANDS phải tạo quy tắc chi trả trước khi có thể bật dịch vụ này.';
    }
    return null;
  }

  bool canSavePrice(int? customerPrice, {required bool active}) =>
      validationMessageForPrice(customerPrice, active: active) == null;
}

class ProviderServicePayoutOption {
  const ProviderServicePayoutOption({
    required this.customerPrice,
    required this.providerPayoutAmount,
    required this.platformFee,
    this.currency = 'VND',
  });

  final int customerPrice;
  final int providerPayoutAmount;
  final int platformFee;
  final String currency;
}

class ProviderServicePriceGroup {
  const ProviderServicePriceGroup({
    required this.key,
    required this.name,
    required this.options,
  });

  final String key;
  final String name;
  final List<ProviderServicePrice> options;

  int get activeOptionCount => options.where((option) => option.active).length;

  int get payoutReadyOptionCount => options
      .where((option) => option.active && option.canActivateAtCurrentPrice)
      .length;

  int get payoutMissingOptionCount => options
      .where((option) => option.active && !option.canActivateAtCurrentPrice)
      .length;

  bool get allStandardDurationsReady {
    final durations = options
        .where((option) => option.active && option.canActivateAtCurrentPrice)
        .map((option) => option.durationMin)
        .toSet();
    return durations.containsAll({60, 90, 120});
  }

  String get durationSummary {
    final durations = options.map((option) => option.durationMin).toList()
      ..sort();
    return durations.map((duration) => '$duration phút').join(', ');
  }
}

List<ProviderServicePriceGroup> groupProviderServicePrices(
  List<ProviderServicePrice> services,
) {
  final groups = <String, List<ProviderServicePrice>>{};
  final names = <String, String>{};

  for (final service in services) {
    final key = providerServiceGroupKey(service);
    groups.putIfAbsent(key, () => <ProviderServicePrice>[]).add(service);
    names.putIfAbsent(key, () => service.name);
  }

  return groups.entries.map((entry) {
    final options = [...entry.value]..sort((left, right) {
        final durationCompare = left.durationMin.compareTo(right.durationMin);
        if (durationCompare != 0) {
          return durationCompare;
        }
        return left.effectivePrice.compareTo(right.effectivePrice);
      });

    return ProviderServicePriceGroup(
      key: entry.key,
      name: names[entry.key] ?? 'Dịch vụ',
      options: options,
    );
  }).toList();
}

String providerServiceGroupKey(ProviderServicePrice service) {
  final groupKey = service.serviceGroupKey?.trim();
  if (groupKey != null && groupKey.isNotEmpty) {
    return groupKey;
  }

  final name = service.name.trim();
  if (name.isNotEmpty) {
    return name.toLowerCase();
  }

  return service.id;
}
