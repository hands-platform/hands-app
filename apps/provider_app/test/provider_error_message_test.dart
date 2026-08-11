import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/features/provider_profile/presentation/provider_error_helpers.dart';

void main() {
  test('does not expose internal server details to Partners', () {
    final message = providerAppErrorMessage(
      ApiException(500, {'message': 'database connection failed at 10.0.0.8'}),
    );

    expect(message, isNot(contains('database')));
    expect(message, 'HANDS tạm thời không khả dụng. Vui lòng thử lại.');
  });
}
