import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/booking/domain/repositories/provider_booking_repository.dart';
import 'features/booking/presentation/providers/booking_providers.dart';
import 'features/chat/domain/repositories/chat_repository.dart';
import 'features/chat/presentation/providers/chat_providers.dart';
import 'features/earnings/domain/repositories/provider_earnings_repository.dart';
import 'features/earnings/presentation/providers/earnings_providers.dart';
import 'features/map/domain/services/provider_location_heartbeat.dart';
import 'features/notification/domain/repositories/push_notification_repository.dart';
import 'features/notification/presentation/providers/notification_providers.dart';
import 'features/provider_profile/domain/repositories/provider_profile_repository.dart';
import 'features/provider_profile/presentation/providers/provider_profile_providers.dart';
import 'features/verification/domain/repositories/provider_verification_repository.dart';
import 'features/verification/presentation/providers/verification_providers.dart';

export 'core/providers.dart';
export 'features/auth/presentation/providers/auth_providers.dart';
export 'features/booking/presentation/providers/booking_providers.dart';
export 'features/chat/presentation/providers/chat_providers.dart';
export 'features/earnings/presentation/providers/earnings_providers.dart';
export 'features/map/domain/services/provider_location_heartbeat.dart';
export 'features/map/presentation/providers/map_providers.dart';
export 'features/notification/presentation/providers/notification_providers.dart';
export 'features/provider_profile/presentation/providers/provider_profile_providers.dart';
export 'features/verification/presentation/providers/verification_providers.dart';

final providerRepositoryProvider = Provider<ProviderRepository>((ref) {
  return ProviderRepository(
    ref.read(providerProfileRepositoryProvider),
    ref.read(providerBookingRepositoryProvider),
    ref.read(chatRepositoryProvider),
    ref.read(providerEarningsRepositoryProvider),
    ref.read(pushNotificationRepositoryProvider),
    ref.read(providerVerificationRepositoryProvider),
  );
});

final providerLocationHeartbeatProvider =
    Provider<ProviderLocationHeartbeat>((ref) {
  final heartbeat = ProviderLocationHeartbeat(() async {
    await ref.read(providerRepositoryProvider).updateLocation();
  });
  ref.onDispose(heartbeat.dispose);
  return heartbeat;
});

final providerLocationHeartbeatStatusProvider =
    StreamProvider<ProviderLocationHeartbeatSnapshot>((ref) {
  final heartbeat = ref.watch(providerLocationHeartbeatProvider);
  return heartbeat.snapshots;
});

class ProviderRepository {
  ProviderRepository(
      this._profileRepository,
      this._bookingRepository,
      this._chatRepository,
      this._earningsRepository,
      this._notificationRepository,
      this._verificationRepository);

  final ProviderProfileRepository _profileRepository;
  final ProviderBookingRepository _bookingRepository;
  final ChatRepository _chatRepository;
  final ProviderEarningsRepository _earningsRepository;
  final PushNotificationRepository _notificationRepository;
  final ProviderVerificationRepository _verificationRepository;

  Future<void> goOnline() async {
    await _profileRepository.goOnline();
  }

  Future<void> goOffline() async {
    await _profileRepository.goOffline();
  }

  Future<Map<String, double>> updateLocation({String? bookingId}) async {
    return _profileRepository.updateLocation(bookingId: bookingId);
  }

  Future<Map<String, dynamic>> providerMe() async {
    return _profileRepository.providerMe();
  }

  Future<List<dynamic>> openBookings() async {
    return _bookingRepository.openBookings();
  }

  Future<List<dynamic>> listBookings() async {
    return _bookingRepository.listBookings();
  }

  Future<List<dynamic>> requestBookings() async {
    return _bookingRepository.requestBookings();
  }

  Future<Map<String, dynamic>> joinBooking(String bookingId) async {
    return _bookingRepository.joinBooking(bookingId);
  }

  Future<Map<String, dynamic>> acceptBooking(String bookingId) async {
    return _bookingRepository.acceptBooking(bookingId);
  }

  Future<Map<String, dynamic>> rejectBooking(String bookingId) async {
    return _bookingRepository.rejectBooking(bookingId);
  }

  Future<Map<String, dynamic>> startBooking(String bookingId) async {
    return _bookingRepository.startBooking(bookingId);
  }

  Future<List<dynamic>> listChatMessages(String chatRoomId) async {
    return _chatRepository.listChatMessages(chatRoomId);
  }

  void joinChat(String chatRoomId) {
    _chatRepository.joinChat(chatRoomId);
  }

  void sendChatMessage(String chatRoomId, String text) {
    _chatRepository.sendChatMessage(chatRoomId, text);
  }

  Future<void> registerPushToken(String token) async {
    await _notificationRepository.registerDeviceToken(token: token);
  }

  Future<Map<String, dynamic>> earningsSummary() async {
    return _earningsRepository.earningsSummary();
  }

  Future<List<dynamic>> earnings() async {
    return _earningsRepository.earnings();
  }

  Future<List<dynamic>> payoutBatches() async {
    return _earningsRepository.payoutBatches();
  }

  Future<Map<String, dynamic>> verification() async {
    return _verificationRepository.verification();
  }

  Future<Map<String, dynamic>> createVerificationUpload(
      {String contentType = 'image/jpeg'}) async {
    return _verificationRepository.createVerificationUpload(
      contentType: contentType,
    );
  }

  Future<Map<String, dynamic>> uploadVerificationFile({
    required List<int> bytes,
    required String contentType,
  }) async {
    return _verificationRepository.uploadVerificationFile(
      bytes: bytes,
      contentType: contentType,
    );
  }

  Future<Map<String, dynamic>> submitVerification(
      {List<String> fileIds = const []}) async {
    return _verificationRepository.submitVerification(fileIds: fileIds);
  }
}
