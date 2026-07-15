import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../app_state.dart';
import '../../../core/customer_value_helpers.dart';
import '../../map/presentation/customer_location_helpers.dart';

class BookingSectionCard extends StatelessWidget {
  const BookingSectionCard({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class ServiceTag extends StatelessWidget {
  const ServiceTag({
    super.key,
    required this.label,
  });

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE6E0D2)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(fontWeight: FontWeight.w600),
      ),
    );
  }
}

int customerBookingTimestamp(Map<String, dynamic> booking) {
  final value = booking['updatedAt'] ?? booking['createdAt'];
  if (value is String) {
    return DateTime.tryParse(value)?.millisecondsSinceEpoch ?? 0;
  }
  return 0;
}

bool isCustomerActiveBooking(Map<String, dynamic> booking) {
  return const {
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE'
  }.contains(booking['status']);
}

bool isCustomerClosedBooking(Map<String, dynamic> booking) {
  return const {'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'}
      .contains(booking['status']);
}

bool isCustomerAppChatVisible(Map<String, dynamic>? booking) {
  if (booking == null) {
    return false;
  }
  return asMap(booking['chatRoom']) != null &&
      !isCustomerClosedBooking(booking);
}

bool canCustomerDirectlyCancelBooking(Map<String, dynamic>? booking) {
  if (booking == null || booking['status'] != 'OPEN_MATCHING') {
    return false;
  }
  if (asMap(booking['selectedProvider']) != null) {
    return false;
  }
  final participants = asList(booking['participants']);
  return !participants.whereType<Map<String, dynamic>>().any((participant) {
    return participant['status'] == 'ACCEPTED' ||
        participant['status'] == 'SELECTED';
  });
}

bool customerParticipantSelectableForFinalChoice(
  Map<String, dynamic> participant, {
  String? preferredProviderId,
}) {
  final providerProfileId = customerParticipantPartnerId(participant);
  if (providerProfileId == null || providerProfileId.isEmpty) {
    return false;
  }

  final status = participant['status']?.toString().toUpperCase();
  if (status == 'ACCEPTED') {
    return true;
  }
  if (status == 'JOINED') {
    return providerProfileId != preferredProviderId;
  }
  return false;
}

String? customerParticipantPartnerId(Map<String, dynamic> participant) {
  for (final value in [
    participant['providerProfileId'],
    participant['providerId'],
    asMap(participant['providerProfile'])?['id'],
    asMap(participant['provider'])?['id'],
  ]) {
    final text = value?.toString().trim();
    if (text != null && text.isNotEmpty) {
      return text;
    }
  }
  return null;
}

int customerFinalChoicePriority(Map<String, dynamic> participant) {
  return switch (participant['status']?.toString().toUpperCase()) {
    'ACCEPTED' => 3,
    'JOINED' => 2,
    _ => 0,
  };
}

List<Map<String, dynamic>> customerSelectableMarketplaceParticipants(
  List<dynamic> participants, {
  String? preferredProviderId,
}) {
  final byPartner = <String, Map<String, dynamic>>{};
  for (final participant in participants.whereType<Map<String, dynamic>>()) {
    if (!customerParticipantSelectableForFinalChoice(
      participant,
      preferredProviderId: preferredProviderId,
    )) {
      continue;
    }

    final partnerId = customerParticipantPartnerId(participant);
    if (partnerId == null) {
      continue;
    }

    final current = byPartner[partnerId];
    if (current == null ||
        customerFinalChoicePriority(participant) >
            customerFinalChoicePriority(current)) {
      byPartner[partnerId] = participant;
    }
  }
  return byPartner.values.toList();
}

bool customerCancellationNeedsOpsReview(String status) {
  return const {
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  }.contains(status);
}

String formatCustomerRequestOpenedMoment(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'Soon';
  }
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) {
    return 'Soon';
  }
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  return '${parsed.month.toString().padLeft(2, '0')}/${parsed.day.toString().padLeft(2, '0')} $hour:$minute';
}

String customerBookingNextAction(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'OPEN_MATCHING' =>
      'Waiting for the selected partner or marketplace partners to respond.',
    'MATCHED' =>
      'Partner confirmed. Chat is ready to coordinate service start.',
    'PROVIDER_ON_THE_WAY' =>
      'Track the partner location and keep your phone nearby.',
    'ARRIVED' => 'Partner arrived. Confirm details before service starts.',
    'IN_SERVICE' => 'Service is in progress. Use Chat if you need help.',
    'COMPLETED' => 'Service complete. Review when ready.',
    'CANCELLED' => 'Cancelled. Any payment hold should be released.',
    'REFUNDED' => 'Refund recorded. Check payment status if needed.',
    'NO_SHOW' =>
      'No-show recorded by HANDS operations. Chat evidence remains available to support review.',
    _ => 'Review this booking status before taking action.',
  };
}

Map<String, dynamic>? latestActiveBooking(List<dynamic> bookings) {
  const activeStatuses = {
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  };
  final items = bookings
      .whereType<Map<String, dynamic>>()
      .where((booking) => activeStatuses.contains(booking['status']))
      .toList()
    ..sort((left, right) {
      final leftValue = (left['openedAt'] ?? left['createdAt'] ?? '') as String;
      final rightValue =
          (right['openedAt'] ?? right['createdAt'] ?? '') as String;
      return rightValue.compareTo(leftValue);
    });
  return items.isEmpty ? null : items.first;
}

Map<String, dynamic>? firstBookingService(Map<String, dynamic> booking) {
  final services = booking['services'] is List<dynamic>
      ? booking['services'] as List<dynamic>
      : [];
  if (services.isEmpty) {
    return null;
  }
  final first = asMap(services.first);
  if (first == null) {
    return null;
  }
  final service = asMap(first['service']);
  if (service == null) {
    return null;
  }
  final bookingPrice = asNum(first['price'])?.toInt();
  return {
    ...service,
    'bookingServiceId': first['id'],
    if (bookingPrice != null) 'bookingPrice': bookingPrice,
    if (bookingPrice != null) 'effectivePrice': bookingPrice,
  };
}

String providerDisplayName(Map<String, dynamic>? booking) {
  if (booking == null) {
    return 'Booking';
  }
  final provider = activeBookingProvider(booking);
  if (provider != null) {
    return provider['displayName'] as String? ?? 'Selected partner';
  }
  final participants = booking['participants'] is List<dynamic>
      ? booking['participants'] as List<dynamic>
      : [];
  final preferredProvider = asMap(booking['preferredProvider']);
  final selectableParticipants = customerSelectableMarketplaceParticipants(
    participants,
    preferredProviderId: preferredProvider?['id']?.toString() ??
        booking['preferredProviderId']?.toString(),
  );
  if (selectableParticipants.isNotEmpty) {
    final first = selectableParticipants.first;
    final providerProfile = first['providerProfile'] as Map<String, dynamic>?;
    if (providerProfile != null) {
      return providerProfile['displayName'] as String? ?? 'Partner';
    }
  }
  return 'Booking request';
}

Map<String, dynamic>? activeBookingProvider(Map<String, dynamic>? booking) {
  if (booking == null) {
    return null;
  }

  final status = booking['status'] as String?;
  if (status == 'OPEN_MATCHING') {
    final preferred = booking['preferredProvider'];
    if (preferred is Map<String, dynamic>) {
      return preferred;
    }
  }

  final selected = booking['selectedProvider'];
  return selected is Map<String, dynamic> ? selected : null;
}

double providerAverageRating(Map<String, dynamic> provider) {
  final aggregateRating = asDouble(provider['ratingAvg']);
  if (aggregateRating != null && aggregateRating > 0) {
    return aggregateRating;
  }

  final reviews = asList(provider['reviews']);
  if (reviews.isEmpty) {
    return 5;
  }
  final total = reviews.fold<double>(0, (sum, item) {
    final rating = asNum(asMap(item)?['rating']) ?? 0;
    return sum + rating.toDouble();
  });
  return total / reviews.length;
}

int providerReviewCount(Map<String, dynamic> provider) {
  final aggregateCount = asNum(provider['reviewCount'])?.toInt();
  if (aggregateCount != null && aggregateCount >= 0) {
    return aggregateCount;
  }

  final reviews = provider['reviews'];
  if (reviews is List<dynamic>) {
    return reviews.length;
  }
  return 0;
}

Future<CustomerLocationSnapshot> resolveCustomerLocation(WidgetRef ref) async {
  final position = await ref.read(customerLocationProvider).currentPosition();
  final lat = position?.latitude;
  final lng = position?.longitude;
  if (lat != null && lng != null) {
    if (!isVietnamCoordinate(lat, lng)) {
      return CustomerLocationSnapshot(
        latitude: demoCustomerLat,
        longitude: demoCustomerLng,
        addressText: demoCustomerAddress,
        isDemoLocation: true,
        currentLatitude: lat,
        currentLongitude: lng,
      );
    }
    return CustomerLocationSnapshot(
      latitude: lat,
      longitude: lng,
      addressText: 'Current GPS location',
      currentLatitude: lat,
      currentLongitude: lng,
    );
  }
  return const CustomerLocationSnapshot(
    latitude: demoCustomerLat,
    longitude: demoCustomerLng,
    addressText: demoCustomerAddress,
    isDemoLocation: true,
  );
}

Future<CustomerLocationSnapshot> resolveDiscoveryLocation(WidgetRef ref) async {
  final selected = ref.read(selectedCustomerLocationProvider);
  if (selected != null) {
    return discoveryLocationFromSelected(selected);
  }
  return defaultVietnamDiscoveryLocation();
}

String formatDistance(num? meters) {
  if (meters == null) {
    return '?';
  }
  if (meters >= 1000) {
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }
  return '${meters.round()} m';
}

LatLng? deriveProviderLatLng(Map<String, dynamic>? provider) {
  final lat = asDouble(provider?['currentLat']) ?? asDouble(provider?['lat']);
  final lng = asDouble(provider?['currentLng']) ?? asDouble(provider?['lng']);
  if (lat == null || lng == null) {
    return null;
  }
  return LatLng(lat, lng);
}

String formatLastLocation(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'not shared yet';
  }
  final date = DateTime.tryParse(raw)?.toLocal();
  if (date == null) {
    return 'not shared yet';
  }
  final difference = DateTime.now().difference(date);
  if (difference.inMinutes < 1) {
    return 'just now';
  }
  if (difference.inMinutes < 60) {
    return '${difference.inMinutes}m ago';
  }
  if (difference.inHours < 24) {
    return '${difference.inHours}h ago';
  }
  return '${difference.inDays}d ago';
}

String providerLocationStatusLabel(dynamic value) {
  final raw = value?.toString();
  final date = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (date == null) {
    return 'Location not shared';
  }
  final difference = DateTime.now().difference(date);
  if (difference.inMinutes < 30) {
    return 'Recent location';
  }
  if (difference.inHours < 24) {
    return 'Last location not recent';
  }
  return 'Old saved location';
}

Color providerLocationStatusColor(dynamic value) {
  final raw = value?.toString();
  final date = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (date == null) {
    return Colors.black54;
  }
  final difference = DateTime.now().difference(date);
  if (difference.inMinutes < 30) {
    return const Color(0xFF5E8E4A);
  }
  if (difference.inHours < 24) {
    return const Color(0xFF9A6A18);
  }
  return Colors.black54;
}

String providerLocationFreshnessLabel(Map<String, dynamic> provider) {
  final ageLabel = formatLastLocation(provider['currentLocationUpdatedAt']);
  if (ageLabel == 'not shared yet') {
    return 'Location not shared yet';
  }
  if (provider['isRecentLocation'] == false) {
    return 'Last updated $ageLabel';
  }
  return 'Location $ageLabel';
}

LatLng? deriveBookingLatLng(Map<String, dynamic>? booking) {
  final snapshot = asMap(booking?['addressSnapshot']);
  final lat = asDouble(snapshot?['lat']) ??
      asDouble(snapshot?['latitude']) ??
      asDouble(booking?['lat']);
  final lng = asDouble(snapshot?['lng']) ??
      asDouble(snapshot?['longitude']) ??
      asDouble(booking?['lng']);
  if (lat == null || lng == null) {
    return null;
  }
  return LatLng(lat, lng);
}

LatLng? deriveRealtimeLatLng(Map<String, dynamic>? payload) {
  final lat = asDouble(payload?['lat']);
  final lng = asDouble(payload?['lng']);
  if (lat == null || lng == null) {
    return null;
  }
  return LatLng(lat, lng);
}

Map<String, dynamic>? bookingLatestProviderLocation(
    Map<String, dynamic>? booking) {
  final snapshots = asList(booking?['snapshots']);
  if (snapshots.isEmpty) {
    return null;
  }
  final snapshot = asMap(snapshots.first);
  if (deriveRealtimeLatLng(snapshot) == null) {
    return null;
  }
  return snapshot;
}

String formatCoordinate(double? value) {
  if (value == null) {
    return '-';
  }
  return value.toStringAsFixed(4);
}

double bookingProgress(String status) {
  switch (status) {
    case 'OPEN_MATCHING':
      return 0.15;
    case 'MATCHED':
      return 0.5;
    case 'PROVIDER_ON_THE_WAY':
      return 0.7;
    case 'ARRIVED':
      return 0.82;
    case 'IN_SERVICE':
      return 1;
    default:
      return 0.08;
  }
}

String waitingStepLabel(String status) {
  switch (status) {
    case 'OPEN_MATCHING':
      return 'Waiting';
    case 'MATCHED':
      return 'Confirmed';
    case 'PROVIDER_ON_THE_WAY':
      return 'On the way';
    case 'ARRIVED':
      return 'Arrived';
    case 'IN_SERVICE':
      return 'In service';
    default:
      return status;
  }
}

String waitingSignalLabel(String status, int fallbackCount) {
  if (status == 'IN_SERVICE') {
    return 'Live';
  }
  if (status == 'MATCHED') {
    return 'Ready';
  }
  if (fallbackCount > 0) {
    return 'Options open';
  }
  return 'Pending';
}

WaitingCustomerAction waitingCustomerAction({
  required String status,
  required int fallbackCount,
  required bool hasChatRoom,
  Map<String, dynamic> matchingPolicy = const {},
}) {
  if (status == 'OPEN_MATCHING' && fallbackCount > 0) {
    return const WaitingCustomerAction(
      title: 'Marketplace options are ready',
      body:
          'Your first-pick partner is still being checked. You can keep waiting or switch to a marketplace partner below.',
    );
  }
  if (status == 'OPEN_MATCHING') {
    return WaitingCustomerAction(
      title: 'Waiting for partner response',
      body:
          'No action is needed yet. HANDS is waiting for your chosen partner. ${marketplaceStandbyDescription(matchingPolicy)}',
    );
  }
  if (hasChatRoom && (status == 'MATCHED' || status == 'PROVIDER_ON_THE_WAY')) {
    return const WaitingCustomerAction(
      title: 'Booking confirmed',
      body:
          'Your partner is confirmed. Chat will help coordinate service start and location details.',
    );
  }
  if (status == 'IN_SERVICE') {
    return const WaitingCustomerAction(
      title: 'Service is live',
      body:
          'Continue in chat if you need help during the service. Review becomes available after completion.',
    );
  }
  if (status == 'COMPLETED') {
    return const WaitingCustomerAction(
      title: 'Service complete',
      body: 'Review your service when ready, then return to your bookings.',
    );
  }
  if (status == 'CANCELLED') {
    return const WaitingCustomerAction(
      title: 'Booking cancelled',
      body: 'This request is closed. The booking record remains in Bookings.',
    );
  }
  if (status == 'EXPIRED') {
    return const WaitingCustomerAction(
      title: 'Request expired',
      body: 'No partner was selected before the response window closed.',
    );
  }
  return WaitingCustomerAction(
    title: 'Booking progress',
    body: 'Current booking status: $status.',
  );
}

Map<String, dynamic> bookingMatchingPolicy(Map<String, dynamic>? booking) {
  final metadata = asMap(booking?['metadata']);
  final policy = asMap(metadata?['matchingPolicy']);
  final earlyAcceptMin = asNum(booking?['earlyAcceptMin'])?.toInt();
  return {
    if (policy != null) ...policy,
    if (earlyAcceptMin != null) 'providerResponseWindowMinutes': earlyAcceptMin,
  };
}

String responseWindowLabel(Map<String, dynamic> policy) {
  final minutes = asNum(policy['providerResponseWindowMinutes'])?.toInt();
  if (minutes == null || minutes <= 0) {
    return 'the first response window';
  }
  return 'the first $minutes minute response window';
}

String marketplaceRadiusLabel(Map<String, dynamic> policy) {
  final meters = (asNum(policy['marketplaceRadiusMeters']) ??
          asNum(policy['backupProviderRadiusMeters']))
      ?.toInt();
  if (meters == null || meters <= 0) {
    return 'nearby';
  }
  if (meters >= 1000) {
    final km = meters / 1000;
    final text = km == km.roundToDouble()
        ? km.toInt().toString()
        : km.toStringAsFixed(1);
    return 'within $text km';
  }
  return 'within ${meters}m';
}

bool marketplaceOpensImmediately(Map<String, dynamic> policy) {
  return policy['backupOpenMode']?.toString() == 'IMMEDIATE_WITHIN_WINDOW';
}

String marketplaceWindowDescription(Map<String, dynamic> policy) {
  final radius = marketplaceRadiusLabel(policy);
  if (marketplaceOpensImmediately(policy)) {
    return 'marketplace partners $radius can also join during this window';
  }
  return 'marketplace partners $radius can join after this window if needed';
}

String marketplaceStandbyDescription(Map<String, dynamic> policy) {
  final radius = marketplaceRadiusLabel(policy);
  if (marketplaceOpensImmediately(policy)) {
    return 'Marketplace partners $radius can appear as soon as they offer support.';
  }
  return 'Marketplace partners $radius can appear after the first response window if the chosen partner is slow.';
}

String marketplaceParticipationLabel(Map<String, dynamic> policy) {
  return marketplaceOpensImmediately(policy)
      ? 'marketplace options open'
      : 'marketplace options on standby';
}

@Deprecated('Use marketplaceRadiusLabel. Reads legacy policy keys.')
String backupRadiusLabel(Map<String, dynamic> policy) =>
    marketplaceRadiusLabel(policy);

@Deprecated('Use marketplaceOpensImmediately. Reads legacy policy keys.')
bool backupOpensImmediately(Map<String, dynamic> policy) =>
    marketplaceOpensImmediately(policy);

@Deprecated('Use marketplaceWindowDescription. Reads legacy policy keys.')
String backupWindowDescription(Map<String, dynamic> policy) =>
    marketplaceWindowDescription(policy);

@Deprecated('Use marketplaceStandbyDescription. Reads legacy policy keys.')
String backupStandbyDescription(Map<String, dynamic> policy) =>
    marketplaceStandbyDescription(policy);

@Deprecated('Use marketplaceParticipationLabel. Reads legacy policy keys.')
String backupParticipationLabel(Map<String, dynamic> policy) =>
    marketplaceParticipationLabel(policy);

String directRequestDetail(Map<String, dynamic> policy) {
  return 'This partner is getting ${responseWindowLabel(policy)} for your request.';
}

class WaitingCustomerAction {
  const WaitingCustomerAction({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;
}

String chatActionLabel(String status) {
  return switch (status) {
    'IN_SERVICE' => 'Open service chat',
    _ => 'Open chat room',
  };
}

String shortCode(Object? value) {
  final text = value?.toString() ?? '';
  if (text.isEmpty) {
    return '---';
  }
  return text.length <= 8 ? text : text.substring(0, 8);
}

String formatExpiry(String? isoValue) {
  if (isoValue == null) {
    return '--:--';
  }
  final date = DateTime.tryParse(isoValue)?.toLocal();
  if (date == null) {
    return '--:--';
  }
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

String formatRemainingTime(String? isoValue) {
  if (isoValue == null) {
    return '--';
  }
  final date = DateTime.tryParse(isoValue)?.toLocal();
  if (date == null) {
    return '--';
  }
  final difference = date.difference(DateTime.now());
  if (difference.isNegative) {
    return 'expired';
  }
  if (difference.inMinutes <= 0) {
    return '${difference.inSeconds.remainder(60).abs()}s left';
  }
  return '${difference.inMinutes}m left';
}
