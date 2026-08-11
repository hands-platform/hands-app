import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/booking/domain/repositories/provider_booking_repository.dart';
import 'features/booking/domain/services/provider_booking_detail_view_tracker.dart';
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
import 'features/provider_onboarding/domain/repositories/provider_onboarding_repository.dart';
import 'features/provider_onboarding/presentation/providers/provider_onboarding_providers.dart';
import 'features/verification/domain/repositories/provider_verification_repository.dart';
import 'features/verification/presentation/providers/verification_providers.dart';

export 'core/providers.dart';
export 'features/auth/presentation/providers/auth_providers.dart';
export 'features/booking/presentation/providers/booking_providers.dart';
export 'features/booking/domain/services/provider_booking_detail_view_tracker.dart';
export 'features/chat/presentation/providers/chat_providers.dart';
export 'features/earnings/presentation/providers/earnings_providers.dart';
export 'features/map/domain/services/provider_location_heartbeat.dart';
export 'features/map/presentation/providers/map_providers.dart';
export 'features/notification/presentation/providers/notification_providers.dart';
export 'features/provider_onboarding/presentation/providers/provider_onboarding_providers.dart';
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
    ref.read(providerOnboardingRepositoryProvider),
  );
});

final providerLocationHeartbeatProvider =
    Provider<ProviderLocationHeartbeat>((ref) {
  final repository = ref.read(providerRepositoryProvider);
  final heartbeat = ProviderLocationHeartbeat(
    () async {
      await repository.updateLocation();
    },
    updateBookingLocation: (bookingId) async {
      await repository.updateLocation(bookingId: bookingId);
    },
  );
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
      this._verificationRepository,
      this._onboardingRepository);

  final ProviderProfileRepository _profileRepository;
  final ProviderBookingRepository _bookingRepository;
  final ChatRepository _chatRepository;
  final ProviderEarningsRepository _earningsRepository;
  final PushNotificationRepository _notificationRepository;
  final ProviderVerificationRepository _verificationRepository;
  final ProviderOnboardingRepository _onboardingRepository;

  Future<void> goOnline() async {
    await _profileRepository.goOnline();
  }

  Future<void> goOffline() async {
    await _profileRepository.goOffline();
  }

  Future<Map<String, dynamic>> recordDeviceSession() async {
    return _profileRepository.recordDeviceSession();
  }

  Future<Map<String, dynamic>> updateLocation({
    String? bookingId,
    bool includeAddressText = false,
  }) async {
    return _profileRepository.updateLocation(
      bookingId: bookingId,
      includeAddressText: includeAddressText,
    );
  }

  Future<Map<String, dynamic>> providerMe() async {
    return _profileRepository.providerMe();
  }

  Future<Map<String, dynamic>> availability() async {
    return _profileRepository.availability();
  }

  Future<Map<String, dynamic>> updateWorkingHours(
    List<Map<String, dynamic>> workingHours,
  ) async {
    return _profileRepository.updateWorkingHours(workingHours);
  }

  Future<Map<String, dynamic>> uploadProfileImage({
    required List<int> bytes,
    required String contentType,
  }) async {
    return _profileRepository.uploadProfileImage(
      bytes: bytes,
      contentType: contentType,
    );
  }

  Future<Map<String, dynamic>> uploadGalleryImage({
    required List<int> bytes,
    required String contentType,
  }) async {
    return _profileRepository.uploadGalleryImage(
      bytes: bytes,
      contentType: contentType,
    );
  }

  Future<List<dynamic>> openBookings() async {
    return _bookingRepository.openBookings();
  }

  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async {
    return _bookingRepository.listBookings(
      scope: scope,
      cursor: cursor,
      take: take,
    );
  }

  Future<List<dynamic>> requestBookings() async {
    return _bookingRepository.requestBookings();
  }

  Future<Map<String, dynamic>> bookingAlertPreferences() async {
    return _bookingRepository.bookingAlertPreferences();
  }

  Future<Map<String, dynamic>> updateBookingAlertPreferences(
    Map<String, dynamic> preferences,
  ) async {
    return _bookingRepository.updateBookingAlertPreferences(preferences);
  }

  Future<Map<String, dynamic>> joinBooking(String bookingId) async {
    return _bookingRepository.joinBooking(bookingId);
  }

  Future<Map<String, dynamic>> acceptBooking(String bookingId) async {
    return _bookingRepository.acceptBooking(bookingId);
  }

  Future<Map<String, dynamic>> rejectBooking(
    String bookingId, {
    String? reasonCode,
    String? reasonDetail,
  }) async {
    return _bookingRepository.rejectBooking(
      bookingId,
      reasonCode: reasonCode,
      reasonDetail: reasonDetail,
    );
  }

  Future<Map<String, dynamic>> completeBooking(
    String bookingId, {
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    return _bookingRepository.completeBooking(
      bookingId,
      lat: lat,
      lng: lng,
      addressText: addressText,
    );
  }

  Future<Map<String, dynamic>> cancelBooking(
    String bookingId, {
    required String reasonCode,
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    return _bookingRepository.cancelBooking(
      bookingId,
      reasonCode: reasonCode,
      note: note,
      lat: lat,
      lng: lng,
      addressText: addressText,
    );
  }

  Future<Map<String, dynamic>> recordBookingDetailView(
    String bookingId, {
    required ProviderBookingDetailViewTelemetryEvent eventType,
    Duration? duration,
  }) async {
    return _bookingRepository.recordDetailViewTelemetry(
      bookingId,
      eventType: eventType,
      duration: duration,
    );
  }

  Future<List<dynamic>> listChatMessages(String chatRoomId) async {
    return _chatRepository.listChatMessages(chatRoomId);
  }

  Future<Map<String, dynamic>> chatNotificationSummary() async {
    return _chatRepository.notificationSummary();
  }

  Future<Map<String, dynamic>> markChatNotificationsRead(
      String chatRoomId) async {
    return _chatRepository.markNotificationsRead(chatRoomId);
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

  Future<Map<String, dynamic>> earningsSummary() async {
    return _earningsRepository.earningsSummary();
  }

  Future<List<dynamic>> earnings() async {
    return _earningsRepository.earnings();
  }

  Future<List<dynamic>> payoutBatches() async {
    return _earningsRepository.payoutBatches();
  }

  Future<List<dynamic>> walletWithdrawalRequests() async {
    return _earningsRepository.walletWithdrawalRequests();
  }

  Future<Map<String, dynamic>> createWalletWithdrawalRequest({
    required int amount,
    String? bankAccountId,
    String? requestNote,
  }) async {
    return _earningsRepository.createWalletWithdrawalRequest(
      amount: amount,
      bankAccountId: bankAccountId,
      requestNote: requestNote,
    );
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

  Future<Map<String, dynamic>> onboardingSnapshot() async {
    return _onboardingRepository.snapshot();
  }

  Future<Map<String, dynamic>> updateOnboardingBasicProfile(
      Map<String, dynamic> input) async {
    return _onboardingRepository.updateBasicProfile(input);
  }

  Future<Map<String, dynamic>> submitOnboardingKyc({
    String? cccdNumber,
    List<Map<String, String>> documents = const [],
  }) async {
    return _onboardingRepository.submitKyc(
      cccdNumber: cccdNumber,
      documents: documents,
    );
  }

  Future<Map<String, dynamic>> createOnboardingBankAccount({
    required String bankName,
    String? accountNumber,
    required String accountHolderName,
    Map<String, dynamic>? qrBankingInfo,
  }) async {
    return _onboardingRepository.createBankAccount(
      bankName: bankName,
      accountNumber: accountNumber,
      accountHolderName: accountHolderName,
      qrBankingInfo: qrBankingInfo,
    );
  }

  Future<Map<String, dynamic>> upsertOnboardingTaxProfile({
    String? taxCode,
    required String legalName,
    required String registeredAddress,
  }) async {
    return _onboardingRepository.upsertTaxProfile(
      taxCode: taxCode,
      legalName: legalName,
      registeredAddress: registeredAddress,
    );
  }

  Future<Map<String, dynamic>> acceptOnboardingAgreement({
    required String type,
    required String version,
    String? deviceId,
  }) async {
    return _onboardingRepository.acceptAgreement(
      type: type,
      version: version,
      deviceId: deviceId,
    );
  }
}
