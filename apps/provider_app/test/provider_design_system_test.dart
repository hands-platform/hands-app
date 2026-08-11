import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/provider_design_system.dart';

void main() {
  test('partner app uses the HANDS customer visual contract', () {
    expect(HandsColors.light.canvas, const Color(0xFFF4F3EE));
    expect(HandsColors.light.primary, const Color(0xFF25534D));
    expect(HandsColors.dark.canvas, const Color(0xFF111411));
    final lightTheme = buildProviderTheme();
    expect(lightTheme.cardTheme.elevation, 0);
    expect(
      lightTheme.colorScheme.errorContainer,
      const Color(0xFFF3E1DE),
    );
    expect(
      buildProviderTheme(brightness: Brightness.dark).useMaterial3,
      isTrue,
    );
  });
}
