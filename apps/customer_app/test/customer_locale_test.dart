import 'package:customer_app/src/core/customer_locale.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('stores a supported customer language choice', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final controller = CustomerLocaleController(const FlutterSecureStorage());

    await controller.setLocale(const Locale('ko'));

    expect(controller.state, const Locale('ko'));
    expect(
      await const FlutterSecureStorage().read(
        key: CustomerLocaleController.storageKey,
      ),
      'ko',
    );
  });
}
