import 'dart:async';
import 'dart:convert';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const customerMarketingAttributionStorageKey =
    'hands.customer.marketing_attribution.v1';

const _buildMarketingSource = String.fromEnvironment('MARKETING_SOURCE');
const _buildMarketingCampaignId =
    String.fromEnvironment('MARKETING_CAMPAIGN_ID');
const _buildMarketingMedium = String.fromEnvironment('MARKETING_MEDIUM');

class CustomerMarketingAttribution {
  const CustomerMarketingAttribution({
    required this.source,
    required this.capturedAt,
    this.campaignId,
    this.medium,
  });

  final String source;
  final String? campaignId;
  final String? medium;
  final DateTime capturedAt;

  Map<String, dynamic> toJson() => {
        'source': source,
        if (campaignId != null) 'campaignId': campaignId,
        if (medium != null) 'medium': medium,
        'capturedAt': capturedAt.toUtc().toIso8601String(),
      };

  static CustomerMarketingAttribution? fromJson(Object? value) {
    if (value is! Map) {
      return null;
    }
    final source = normalizeCustomerMarketingSource(value['source']);
    final capturedAt = DateTime.tryParse('${value['capturedAt'] ?? ''}');
    if (source == null || capturedAt == null) {
      return null;
    }
    return CustomerMarketingAttribution(
      source: source,
      campaignId: normalizeCustomerMarketingText(value['campaignId'], 120),
      medium: normalizeCustomerMarketingText(value['medium'], 80),
      capturedAt: capturedAt,
    );
  }
}

String? normalizeCustomerMarketingSource(Object? value) {
  final normalized = value?.toString().trim().toLowerCase();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }
  if (normalized.contains('facebook') || normalized.contains('instagram')) {
    return 'meta';
  }
  if (normalized.contains('google')) {
    return 'google';
  }
  if (normalized.contains('tiktok')) {
    return 'tiktok';
  }
  if (normalized.contains('organic')) {
    return 'organic';
  }
  if (normalized.contains('direct')) {
    return 'direct';
  }
  return const {'meta', 'google', 'tiktok', 'organic', 'direct'}
          .contains(normalized)
      ? normalized
      : null;
}

String? normalizeCustomerMarketingText(Object? value, int maxLength) {
  final normalized = value?.toString().trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }
  return normalized.length <= maxLength
      ? normalized
      : normalized.substring(0, maxLength);
}

CustomerMarketingAttribution? customerMarketingAttributionFromUri(
  Uri uri, {
  DateTime? capturedAt,
}) {
  if (uri.scheme.toLowerCase() != 'hands' ||
      uri.host.toLowerCase() != 'open') {
    return null;
  }

  final query = <String, String>{
    for (final entry in uri.queryParameters.entries)
      entry.key.toLowerCase(): entry.value,
  };
  final source = normalizeCustomerMarketingSource(
        query['utm_source'] ?? query['source'],
      ) ??
      customerMarketingSourceFromClickId(query);
  if (source == null) {
    return null;
  }
  return CustomerMarketingAttribution(
    source: source,
    campaignId: normalizeCustomerMarketingText(
      query['utm_campaign'] ??
          query['campaign_id'] ??
          query['campaign'] ??
          query['utm_id'],
      120,
    ),
    medium: normalizeCustomerMarketingText(
      query['utm_medium'] ?? query['medium'],
      80,
    ),
    capturedAt: capturedAt ?? DateTime.now(),
  );
}

String? customerMarketingSourceFromClickId(Map<String, String> query) {
  bool hasValue(String key) => query[key]?.trim().isNotEmpty == true;

  if (hasValue('gclid') || hasValue('gbraid') || hasValue('wbraid')) {
    return 'google';
  }
  if (hasValue('fbclid')) {
    return 'meta';
  }
  if (hasValue('ttclid')) {
    return 'tiktok';
  }
  return null;
}

class CustomerMarketingAttributionStore {
  CustomerMarketingAttributionStore({
    required FlutterSecureStorage storage,
    this.storageKey = customerMarketingAttributionStorageKey,
  }) : _storage = storage;

  final FlutterSecureStorage _storage;
  final String storageKey;
  Future<void> _captureBarrier = Future<void>.value();

  Future<CustomerMarketingAttribution?> read() async {
    final raw = await _storage.read(key: storageKey);
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    try {
      return CustomerMarketingAttribution.fromJson(jsonDecode(raw));
    } on FormatException {
      return null;
    }
  }

  Future<bool> capture(CustomerMarketingAttribution? attribution) {
    if (attribution == null) {
      return Future<bool>.value(false);
    }

    final result = _captureBarrier.then((_) async {
      if (await read() != null) {
        return false;
      }
      await _storage.write(
        key: storageKey,
        value: jsonEncode(attribution.toJson()),
      );
      return true;
    });
    _captureBarrier = result.then<void>((_) {}, onError: (_, __) {});
    return result;
  }

  Future<bool> captureUri(Uri uri, {DateTime? capturedAt}) {
    return capture(
      customerMarketingAttributionFromUri(uri, capturedAt: capturedAt),
    );
  }

  Future<bool> captureBuildAttribution({DateTime? capturedAt}) {
    final source = normalizeCustomerMarketingSource(_buildMarketingSource);
    return capture(
      source == null
          ? null
          : CustomerMarketingAttribution(
              source: source,
              campaignId: normalizeCustomerMarketingText(
                _buildMarketingCampaignId,
                120,
              ),
              medium: normalizeCustomerMarketingText(
                _buildMarketingMedium,
                80,
              ),
              capturedAt: capturedAt ?? DateTime.now(),
            ),
    );
  }

  Future<bool> captureDirectFallback({DateTime? capturedAt}) {
    return capture(
      CustomerMarketingAttribution(
        source: 'direct',
        medium: 'app-open',
        capturedAt: capturedAt ?? DateTime.now(),
      ),
    );
  }

  Future<Map<String, dynamic>?> sessionMetadata() async {
    final attribution = await read();
    return attribution == null
        ? null
        : {'marketingAttribution': attribution.toJson()};
  }
}

abstract interface class CustomerMarketingLinkSource {
  Future<Uri?> getInitialLink();

  Stream<Uri> get uriLinkStream;
}

class AppLinksCustomerMarketingLinkSource
    implements CustomerMarketingLinkSource {
  AppLinksCustomerMarketingLinkSource({AppLinks? appLinks})
      : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;

  @override
  Future<Uri?> getInitialLink() => _appLinks.getInitialLink();

  @override
  Stream<Uri> get uriLinkStream => _appLinks.uriLinkStream;
}

class CustomerMarketingAttributionCapture {
  CustomerMarketingAttributionCapture({
    required CustomerMarketingAttributionStore store,
    CustomerMarketingLinkSource? linkSource,
  })  : _store = store,
        _linkSource = linkSource ?? AppLinksCustomerMarketingLinkSource();

  final CustomerMarketingAttributionStore _store;
  final CustomerMarketingLinkSource _linkSource;
  StreamSubscription<Uri>? _subscription;

  Future<void> start() async {
    _subscription ??= _linkSource.uriLinkStream.listen(
      (uri) => unawaited(_store.captureUri(uri)),
      onError: reportCustomerMarketingAttributionFailure,
    );
    try {
      final initialLink = await _linkSource.getInitialLink();
      if (initialLink != null) {
        await _store.captureUri(initialLink);
      }
    } catch (error, stackTrace) {
      reportCustomerMarketingAttributionFailure(error, stackTrace);
    }
    await _store.captureBuildAttribution();
    await _store.captureDirectFallback();
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}

void reportCustomerMarketingAttributionFailure(
  Object error,
  StackTrace stackTrace,
) {
  if (kDebugMode) {
    debugPrint('Marketing attribution link failed: $error');
    debugPrintStack(stackTrace: stackTrace);
  }
}
