import 'package:customer_app/src/features/discovery/presentation/customer_provider_detail_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('loads one profile view per Partner detail screen lifecycle',
      (tester) async {
    var firstPartnerLoads = 0;
    var replacementLoaderCalls = 0;

    Widget page({
      required String providerId,
      required Future<Map<String, dynamic>> Function() loader,
    }) {
      return MaterialApp(
        home: ProviderDetailPage(
          providerPreview: {
            'id': providerId,
            'displayName':
                providerId == 'partner-1' ? 'Partner One' : 'Partner Two',
          },
          loader: loader,
          onBookService: (_, __) async {},
        ),
      );
    }

    await tester.pumpWidget(
      page(
        providerId: 'partner-1',
        loader: () async {
          firstPartnerLoads += 1;
          return {'id': 'partner-1', 'displayName': 'Partner One'};
        },
      ),
    );
    await tester.pumpAndSettle();

    expect(firstPartnerLoads, 1);
    expect(find.text('Partner One'), findsWidgets);

    await tester.pumpWidget(
      page(
        providerId: 'partner-1',
        loader: () async {
          replacementLoaderCalls += 1;
          return {'id': 'partner-1', 'displayName': 'Partner One'};
        },
      ),
    );
    await tester.pumpAndSettle();

    expect(firstPartnerLoads, 1);
    expect(replacementLoaderCalls, 0);

    await tester.pumpWidget(
      page(
        providerId: 'partner-2',
        loader: () async {
          replacementLoaderCalls += 1;
          return {'id': 'partner-2', 'displayName': 'Partner Two'};
        },
      ),
    );
    await tester.pumpAndSettle();

    expect(replacementLoaderCalls, 1);
    expect(find.text('Partner Two'), findsWidgets);
  });

  testWidgets(
      'shows customer-facing service details and books the selected option',
      (tester) async {
    Map<String, dynamic>? selectedService;

    await tester.pumpWidget(
      MaterialApp(
        home: ProviderDetailPage(
          providerPreview: const {
            'id': 'partner-1',
            'displayName': 'Linh Wellness',
            'distanceMeters': 1200,
          },
          loader: () async => {
            'id': 'partner-1',
            'displayName': 'Linh Wellness',
            'status': 'ONLINE_AVAILABLE',
            'ratingAvg': 4.9,
            'reviewCount': 24,
            'city': 'Ho Chi Minh City',
            'services': [
              {
                'id': 'partner-service-1',
                'price': 500000,
                'active': true,
                'bookable': true,
                'service': {
                  'id': 'service-1',
                  'serviceGroupKey': 'relaxing',
                  'name': 'Relaxing massage',
                  'description': 'A calming full-body massage.',
                  'durationMin': 60,
                  'basePrice': 400000,
                  'priceStep': 100000,
                  'active': true,
                },
              },
            ],
          },
          onBookService: (_, service) async {
            selectedService = service;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Available now'), findsOneWidget);
    expect(find.text('Choose a service'), findsOneWidget);
    expect(find.byTooltip('Copy partner link'), findsOneWidget);
    expect(find.text('Relaxing massage'), findsOneWidget);
    expect(find.text('500.000 VND'), findsWidgets);
    expect(find.textContaining('Admin minimum'), findsNothing);
    expect(find.textContaining('Marketplace matching'), findsNothing);

    await tester.scrollUntilVisible(
      find.text('Select'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Select'));
    await tester.pump();

    expect(selectedService?['id'], 'service-1');
    expect(selectedService?['durationMin'], 60);
  });
}
