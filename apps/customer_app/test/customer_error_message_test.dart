import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/customer_error_message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('does not expose API response details to customers', () {
    final message = customerErrorMessage(
      ApiException(500, const {'message': 'internal database host'}),
    );

    expect(message, contains('temporarily unavailable'));
    expect(message, isNot(contains('database')));
  });
}
