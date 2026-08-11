import 'api_client.dart';

const currentProviderAppVersion = String.fromEnvironment(
  'APP_VERSION',
  defaultValue: '0.1.0+1',
);

class ProviderAppVersionPolicy {
  const ProviderAppVersionPolicy({
    required this.forceUpdate,
    this.minimumSupportedVersion,
    this.latestVersion,
    this.updateUrl,
    this.releaseNotes,
  });

  factory ProviderAppVersionPolicy.fromJson(Map<String, dynamic> json) {
    return ProviderAppVersionPolicy(
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

  bool requiresUpdate([String current = currentProviderAppVersion]) {
    final minimum = minimumSupportedVersion;
    return forceUpdate &&
        minimum != null &&
        compareProviderAppVersions(current, minimum) < 0;
  }
}

Future<ProviderAppVersionPolicy> loadProviderAppVersionPolicy(
  ApiClient api,
) async {
  final result = await api.getJson(
    '/mobile/app-version?appType=PARTNER&platform=ANDROID',
  );
  return ProviderAppVersionPolicy.fromJson(
    result is Map ? Map<String, dynamic>.from(result) : const {},
  );
}

int compareProviderAppVersions(String left, String right) {
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
