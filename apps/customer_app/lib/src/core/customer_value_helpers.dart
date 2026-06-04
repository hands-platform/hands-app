String formatCurrency(dynamic amount) {
  final number = asNum(amount)?.toInt() ?? 0;
  final text = number.toString();
  final buffer = StringBuffer();
  for (var index = 0; index < text.length; index++) {
    final reverseIndex = text.length - index;
    buffer.write(text[index]);
    if (reverseIndex > 1 && reverseIndex % 3 == 1) {
      buffer.write('.');
    }
  }
  return buffer.toString();
}

num? asNum(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value;
  }
  if (value is String) {
    return num.tryParse(value);
  }
  return null;
}

double? asDouble(dynamic value) {
  return asNum(value)?.toDouble();
}

Map<String, dynamic>? asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return null;
}

List<dynamic> asList(dynamic value) {
  return value is List<dynamic> ? value : const [];
}

List<String> asStringList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
  return const [];
}
