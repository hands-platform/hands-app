import 'api_client.dart';

const currentCustomerAppVersion = String.fromEnvironment(
  'APP_VERSION',
  defaultValue: '0.1.0+1',
);

class CustomerAppVersionPolicy {
  const CustomerAppVersionPolicy({
    required this.forceUpdate,
    this.minimumSupportedVersion,
    this.latestVersion,
    this.updateUrl,
    this.releaseNotes,
  });

  factory CustomerAppVersionPolicy.fromJson(Map<String, dynamic> json) {
    return CustomerAppVersionPolicy(
      forceUpdate: json['forceUpdate'] == true,
      minimumSupportedVersion: _text(json['minimumSupportedVersion']),
      latestVersion: _text(json['latestVersion']),
      updateUrl: _text(json['updateUrl']),
      releaseNotes: _text(json['releaseNotes']),
    );
  }

  final bool forceUpdate;
  final String? minimumSupportedVersion;
  final String? latestVersion;
  final String? updateUrl;
  final String? releaseNotes;

  bool requiresUpdate([String current = currentCustomerAppVersion]) {
    final minimum = minimumSupportedVersion;
    return forceUpdate &&
        minimum != null &&
        compareAppVersions(current, minimum) < 0;
  }
}

Future<CustomerAppVersionPolicy> loadCustomerAppVersionPolicy(
  ApiClient api,
) async {
  final result = await api.getJson(
    '/mobile/app-version?appType=CUSTOMER&platform=ANDROID',
  );
  return CustomerAppVersionPolicy.fromJson(
    result is Map ? Map<String, dynamic>.from(result) : const {},
  );
}

int compareAppVersions(String left, String right) {
  final leftParts = _versionParts(left);
  final rightParts = _versionParts(right);
  final count = leftParts.length > rightParts.length
      ? leftParts.length
      : rightParts.length;
  for (var index = 0; index < count; index += 1) {
    final leftPart = index < leftParts.length ? leftParts[index] : 0;
    final rightPart = index < rightParts.length ? rightParts[index] : 0;
    if (leftPart != rightPart) return leftPart.compareTo(rightPart);
  }
  return 0;
}

List<int> _versionParts(String value) {
  return RegExp(r'\d+')
      .allMatches(value)
      .take(4)
      .map((match) => int.tryParse(match.group(0) ?? '') ?? 0)
      .toList();
}

String? _text(Object? value) {
  final normalized = value?.toString().trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}
