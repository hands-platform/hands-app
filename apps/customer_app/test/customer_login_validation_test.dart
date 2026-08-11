import 'package:customer_app/src/features/discovery/presentation/customer_home_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts E.164-style phones and six digit OTP codes', () {
    expect(isValidCustomerPhone('+84901234567'), isTrue);
    expect(isValidCustomerPhone('0901234567'), isFalse);
    expect(isValidCustomerOtp('123456'), isTrue);
    expect(isValidCustomerOtp('12345'), isFalse);
  });
}
