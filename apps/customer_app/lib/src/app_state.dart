import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/booking/domain/repositories/customer_booking_repository.dart';
import 'features/booking/presentation/providers/booking_providers.dart';
import 'features/chat/domain/repositories/chat_repository.dart';
import 'features/chat/presentation/providers/chat_providers.dart';
import 'features/coupon/domain/repositories/customer_coupon_repository.dart';
import 'features/coupon/presentation/providers/coupon_providers.dart';
import 'features/discovery/domain/repositories/customer_discovery_repository.dart';
import 'features/discovery/presentation/providers/discovery_providers.dart';
import 'features/notification/domain/repositories/push_notification_repository.dart';
import 'features/notification/presentation/providers/notification_providers.dart';

export 'core/providers.dart';
export 'features/auth/presentation/providers/auth_providers.dart';
export 'features/booking/presentation/providers/booking_providers.dart';
export 'features/chat/presentation/providers/chat_providers.dart';
export 'features/coupon/presentation/providers/coupon_providers.dart';
export 'features/discovery/presentation/providers/discovery_providers.dart';
export 'features/map/presentation/providers/map_providers.dart';
export 'features/notification/presentation/providers/notification_providers.dart';

final customerRepositoryProvider = Provider<CustomerRepository>((ref) {
  return CustomerRepository(
    ref.read(customerDiscoveryRepositoryProvider),
    ref.read(customerBookingRepositoryProvider),
    ref.read(chatRepositoryProvider),
    ref.read(customerCouponRepositoryProvider),
    ref.read(pushNotificationRepositoryProvider),
  );
});

class CustomerRepository {
  CustomerRepository(
      this._discoveryRepository,
      this._bookingRepository,
      this._chatRepository,
      this._couponRepository,
      this._notificationRepository);

  final CustomerDiscoveryRepository _discoveryRepository;
  final CustomerBookingRepository _bookingRepository;
  final ChatRepository _chatRepository;
  final CustomerCouponRepository _couponRepository;
  final PushNotificationRepository _notificationRepository;

  Future<List<dynamic>> listServices() async {
    return _discoveryRepository.listServices();
  }

  Future<List<dynamic>> nearbyProviders({
    required double lat,
    required double lng,
  }) async {
    return _discoveryRepository.nearbyProviders(lat: lat, lng: lng);
  }

  Future<Map<String, dynamic>> getHomeSummary({
    required double lat,
    required double lng,
  }) async {
    return _discoveryRepository.getHomeSummary(lat: lat, lng: lng);
  }

  Future<Map<String, dynamic>> getWallet() {
    return _discoveryRepository.getWallet();
  }

  Future<Map<String, dynamic>?> saveSelectedLocation({
    required double lat,
    required double lng,
    required String addressText,
  }) async {
    return _discoveryRepository.saveSelectedLocation(
      lat: lat,
      lng: lng,
      addressText: addressText,
    );
  }

  Future<List<Map<String, dynamic>>> listSavedLocations() {
    return _discoveryRepository.listSavedLocations();
  }

  Future<void> deleteSavedLocation(String locationId) {
    return _discoveryRepository.deleteSavedLocation(locationId);
  }

  Future<Map<String, dynamic>> getProviderDetail(String providerId) async {
    final detail = await _discoveryRepository.getProviderDetail(providerId);
    unawaited(
      _discoveryRepository
          .recordProviderProfileView(providerId)
          .catchError((_) {
        // Partner profile viewing should stay available if optional analytics sync fails.
      }),
    );
    return detail;
  }

  Future<bool> isFavoriteProvider(String providerId) async {
    final favorites = await _discoveryRepository.listFavoriteProviderIds();
    return favorites.contains(providerId);
  }

  Future<Set<String>> listFavoriteProviderIds() {
    return _discoveryRepository.listFavoriteProviderIds();
  }

  Future<void> setFavoriteProvider({
    required String providerId,
    required bool favorite,
  }) async {
    await _discoveryRepository.setFavoriteProvider(
      providerId: providerId,
      favorite: favorite,
    );
  }

  Future<void> recordProviderProfileView(String providerId) async {
    await _discoveryRepository.recordProviderProfileView(providerId);
  }

  Future<Map<String, dynamic>> getBooking(String bookingId) async {
    return _bookingRepository.getBooking(bookingId);
  }

  Future<List<dynamic>> listBookings({String? cursor, int take = 20}) async {
    return _bookingRepository.listBookings(cursor: cursor, take: take);
  }

  Future<List<CustomerPaymentMethodOption>> listPaymentMethods() async {
    return _bookingRepository.listPaymentMethods();
  }

  void joinBookingRoom(String bookingId) {
    _bookingRepository.joinBookingRoom(bookingId);
  }

  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    return _bookingRepository.cancelBooking(bookingId);
  }

  Future<Map<String, dynamic>> createReview({
    required String bookingId,
    required int rating,
    String? comment,
  }) async {
    return _bookingRepository.createReview(
      bookingId: bookingId,
      rating: rating,
      comment: comment,
    );
  }

  Future<Map<String, dynamic>> createBooking(
    String serviceId, {
    String? providerId,
    String? couponCode,
    String? selectedLocationId,
    required String paymentMethod,
    required String customerName,
    required String customerPhone,
    required String addressLine,
    required double lat,
    required double lng,
    double? currentLat,
    double? currentLng,
    DateTime? currentLocationUpdatedAt,
  }) async {
    return _bookingRepository.createBooking(
      serviceId,
      providerId: providerId,
      couponCode: couponCode,
      selectedLocationId: selectedLocationId,
      paymentMethod: paymentMethod,
      customerName: customerName,
      customerPhone: customerPhone,
      addressLine: addressLine,
      lat: lat,
      lng: lng,
      currentLat: currentLat,
      currentLng: currentLng,
      currentLocationUpdatedAt: currentLocationUpdatedAt,
    );
  }

  Future<Map<String, dynamic>> selectProvider(
      String bookingId, String providerProfileId) async {
    return _bookingRepository.selectProvider(bookingId, providerProfileId);
  }

  Future<List<dynamic>> listChatMessages(String chatRoomId) async {
    return _chatRepository.listChatMessages(chatRoomId);
  }

  void joinChat(String chatRoomId) {
    _chatRepository.joinChat(chatRoomId);
  }

  Future<Map<String, dynamic>> sendChatMessage(
    String chatRoomId,
    String text,
  ) {
    return _chatRepository.sendChatMessage(chatRoomId, text);
  }

  Future<Map<String, dynamic>> sendChatAttachment(
    String chatRoomId, {
    required List<int> bytes,
    required String contentType,
  }) {
    return _chatRepository.sendChatAttachment(
      chatRoomId,
      bytes: bytes,
      contentType: contentType,
    );
  }

  Future<Uri> getChatAttachmentUri(String fileId) {
    return _chatRepository.getChatAttachmentUri(fileId);
  }

  Future<void> registerPushToken(String token) async {
    await _notificationRepository.registerDeviceToken(token: token);
  }

  Future<Map<String, dynamic>> previewCoupon({
    required String code,
    required String serviceId,
    required int subtotal,
  }) async {
    return _couponRepository.previewCoupon(
      code: code,
      serviceId: serviceId,
      subtotal: subtotal,
    );
  }
}
