import '../../../core/provider_value_helpers.dart';

bool providerBookingIsCash(Map<String, dynamic> booking) {
  final payment = asMap(booking['payment']);
  return payment?['method']?.toString().toUpperCase() == 'CASH' ||
      booking['paymentMethod']?.toString().toUpperCase() == 'CASH';
}

String providerCashBookingSettlementHint(Map<String, dynamic> booking) {
  final payment = asMap(booking['payment']);
  final amount = payment?['amount'] ?? booking['totalAmount'];
  final amountText =
      amount == null ? 'this request' : '${formatCurrency(amount)} VND';
  return 'Cash payment: the customer pays you directly for $amountText. '
      'After completion, HANDS fees and tax withholding can create wallet debt. '
      'Keep your wallet settled so marketplace participation and payout release stay clear.';
}

String providerServiceOptionLabel(Map<String, dynamic>? service) {
  final name = service?['name']?.toString().trim();
  final duration = asNum(service?['durationMin'])?.toInt();
  if (name == null || name.isEmpty) {
    return 'Massage booking';
  }
  if (duration == null || duration <= 0) {
    return name;
  }
  return '$name / $duration min';
}

String providerServiceOptionPriceLabel(
  Map<String, dynamic>? service, {
  dynamic amount,
}) {
  final serviceText = providerServiceOptionLabel(service);
  final price = amount ??
      service?['bookingPrice'] ??
      service?['effectivePrice'] ??
      service?['basePrice'];
  if (price == null) {
    return serviceText;
  }
  return '$serviceText / ${formatCurrency(price)} VND';
}

String providerServiceDurationLabel(Map<String, dynamic>? service) {
  final duration = asNum(service?['durationMin'])?.toInt();
  return duration == null || duration <= 0 ? '- min' : '$duration min';
}
