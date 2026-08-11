import 'dart:io';

import 'package:customer_app/src/core/customer_design_system.dart';
import 'package:customer_app/src/features/discovery/presentation/customer_discovery_widgets.dart';
import 'package:customer_app/src/features/discovery/presentation/customer_home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('HANDS themes keep the approved light and dark tokens', () {
    expect(HandsColors.light.canvas, const Color(0xFFF4F3EE));
    expect(HandsColors.light.primary, const Color(0xFF25534D));
    expect(HandsColors.dark.canvas, const Color(0xFF111411));
    expect(HandsColors.dark.primary, const Color(0xFF8FBFB6));
    expect(buildCustomerTheme(brightness: Brightness.light).cardTheme.elevation,
        0);
    expect(
        buildCustomerTheme(brightness: Brightness.dark).useMaterial3, isTrue);
  });

  testWidgets('partner results use an open row and a 4:5 portrait stage',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildCustomerTheme(brightness: Brightness.light),
        home: Scaffold(
          body: HandsPartnerRow(
            provider: const {
              'id': 'partner-1',
              'displayName': 'Thanh Nguyen',
              'distanceMeters': 850,
            },
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.byType(Card), findsNothing);
    final size = tester.getSize(find.byType(HandsPortraitStage));
    expect(size.width / size.height, closeTo(0.8, 0.01));
    expect(tester.takeException(), isNull);
  });

  testWidgets('home partner rows fit at 360dp with 130% text', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildCustomerTheme(brightness: Brightness.dark),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(1.3),
          ),
          child: child!,
        ),
        home: Scaffold(
          body: CustomerHomePartnerSection(
            title: 'Booked before',
            emptyText: 'No partners yet',
            partners: const [
              {
                'id': 'partner-1',
                'displayName': 'Thanh Thuy',
                'distanceMeters': 850,
              },
              {'id': 'partner-2', 'displayName': '김하늘'},
              {'id': 'partner-3', 'displayName': 'さくら'},
              {'id': 'partner-4', 'displayName': '美玲'},
              {'id': 'partner-5', 'displayName': '美玲（繁體）'},
            ],
            onPartnerTap: (_) {},
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  test('customer UI source does not reintroduce visual elevation', () {
    final files = Directory('lib/src')
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'));
    final positiveElevation = RegExp(r'elevation:\s*[1-9]');

    for (final file in files) {
      final source = file.readAsStringSync();
      expect(source.contains('BoxShadow('), isFalse, reason: file.path);
      expect(positiveElevation.hasMatch(source), isFalse, reason: file.path);
    }
  });
}
