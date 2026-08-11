import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/mobile_app_version.dart';

void main() {
  test('compares Partner app versions including build numbers', () {
    expect(compareProviderAppVersions('1.2.3+4', '1.2.3+5'), lessThan(0));
    expect(compareProviderAppVersions('1.10.0', '1.2.9'), greaterThan(0));
    expect(compareProviderAppVersions('2.0', '2.0.0'), 0);
  });

  test('requires only explicitly forced Partner updates', () {
    const forced = ProviderAppVersionPolicy(
      forceUpdate: true,
      minimumSupportedVersion: '1.2.0',
    );
    const optional = ProviderAppVersionPolicy(
      forceUpdate: false,
      minimumSupportedVersion: '1.2.0',
    );

    expect(forced.requiresUpdate('1.1.9'), isTrue);
    expect(forced.requiresUpdate('1.2.0'), isFalse);
    expect(optional.requiresUpdate('1.0.0'), isFalse);
  });
}
