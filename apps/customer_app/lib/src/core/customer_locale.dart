import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const customerSupportedLocales = [
  Locale('vi'),
  Locale('en'),
  Locale('ko'),
  Locale('ja'),
  Locale('zh'),
];

final customerLocaleProvider =
    StateNotifierProvider<CustomerLocaleController, Locale>((ref) {
  return CustomerLocaleController(const FlutterSecureStorage());
});

class CustomerLocaleController extends StateNotifier<Locale> {
  CustomerLocaleController(this._storage) : super(const Locale('vi')) {
    unawaited(_restore());
  }

  static const storageKey = 'hands.customer.locale.v1';
  final FlutterSecureStorage _storage;

  Future<void> setLocale(Locale locale) async {
    if (!customerSupportedLocales.contains(locale)) return;
    state = locale;
    await _storage.write(key: storageKey, value: locale.languageCode);
  }

  Future<void> _restore() async {
    final code = await _storage.read(key: storageKey);
    final saved = customerSupportedLocales
        .where((locale) => locale.languageCode == code)
        .firstOrNull;
    if (saved != null) state = saved;
  }
}
