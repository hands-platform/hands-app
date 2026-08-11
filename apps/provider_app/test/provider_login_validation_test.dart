import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/booking/presentation/provider_request_panels.dart';

void main() {
  test('accepts E.164-style Partner phones and six digit OTP codes', () {
    expect(isValidProviderPhone('+84901234567'), isTrue);
    expect(isValidProviderPhone('0901234567'), isFalse);
    expect(isValidProviderOtp('123456'), isTrue);
    expect(isValidProviderOtp('12345'), isFalse);
  });
}
