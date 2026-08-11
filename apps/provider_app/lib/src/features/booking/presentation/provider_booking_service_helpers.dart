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
      amount == null ? 'yêu cầu này' : '${formatCurrency(amount)} VND';
  return 'Thanh toán tiền mặt: khách hàng trả trực tiếp cho bạn $amountText. '
      'Sau khi hoàn thành, phí HANDS và thuế khấu trừ có thể tạo số dư ví âm. '
      'Hãy thanh toán đầy đủ để tiếp tục tham gia đặt lịch công khai và nhận chi trả.';
}

String providerServiceOptionLabel(Map<String, dynamic>? service) {
  final name = service?['name']?.toString().trim();
  final duration = asNum(service?['durationMin'])?.toInt();
  if (name == null || name.isEmpty) {
    return 'Dịch vụ massage';
  }
  if (duration == null || duration <= 0) {
    return name;
  }
  return '$name / $duration phút';
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
  return duration == null || duration <= 0 ? '- phút' : '$duration phút';
}
