import '../../../core/provider_value_helpers.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';

bool isProviderClosedBooking(Map<String, dynamic> booking) {
  return const {'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'}
      .contains(booking['status']);
}

bool isProviderAppChatVisible(Map<String, dynamic>? booking) {
  if (booking == null) {
    return false;
  }
  return asMap(booking['chatRoom']) != null &&
      !isProviderClosedBooking(booking);
}

class ProviderRequestGuidance {
  const ProviderRequestGuidance({
    required this.modeLabel,
    required this.priorityLabel,
    required this.roleLabel,
    required this.decisionLabel,
    required this.nextAction,
    required this.contextMessage,
    required this.detailMessage,
    required this.infoMessage,
  });

  final String modeLabel;
  final String priorityLabel;
  final String roleLabel;
  final String decisionLabel;
  final String nextAction;
  final String contextMessage;
  final String detailMessage;
  final String infoMessage;
}

ProviderRequestGuidance providerRequestGuidance({
  required Map<String, dynamic> booking,
  required bool isPreferredRequest,
  required bool joined,
  required bool walletBlocked,
}) {
  final preferredProvider = asMap(booking['preferredProvider']);
  final hasPreferredProvider = preferredProvider != null;
  final preferredProviderName =
      preferredProvider?['displayName']?.toString().trim();
  final hasChat = isProviderAppChatVisible(booking);
  final isMatched = booking['status'] == 'MATCHED';
  final actionBlockedByWallet = providerWalletBlocksMarketplaceParticipation(
    walletBlocked: walletBlocked,
    isPreferredRequest: isPreferredRequest,
    isMatched: isMatched,
  );
  final responseWindowLabel = providerMatchingWindowText(booking);
  final marketplaceRadiusLabel = providerMarketplaceRadiusText(booking);

  final modeLabel = isPreferredRequest
      ? 'Direct request'
      : hasPreferredProvider
          ? 'Marketplace opportunity'
          : 'Open candidate list';
  final priorityLabel = isPreferredRequest
      ? 'Reply first'
      : hasPreferredProvider
          ? 'Marketplace option'
          : 'Open queue';
  final roleLabel = isPreferredRequest
      ? 'First partner'
      : hasPreferredProvider
          ? 'Marketplace option'
          : 'Open candidate';

  if (actionBlockedByWallet) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Settlement required',
      nextAction:
          'Settle unpaid HANDS fees before marketplace participation.',
      contextMessage:
          'This marketplace booking is visible, but unpaid HANDS fees must be settled before marketplace participation.',
      detailMessage: providerWalletBlockFallbackReasonClean,
      infoMessage: providerWalletBlockHintClean,
    );
  }

  if (isPreferredRequest && hasChat) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Chat live',
      nextAction: 'Continue with the customer in chat.',
      contextMessage:
          'The customer picked your profile first and the service chat is now live.',
      detailMessage:
          'You were chosen first and the service chat is already live.',
      infoMessage: 'Chat is ready for this matched booking.',
    );
  }

  if (isPreferredRequest && isMatched) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Accepted',
      nextAction:
          'Open chat to coordinate arrival, then start the service when ready.',
      contextMessage:
          'The customer picked your profile and chat should already be ready.',
      detailMessage:
          'You were chosen first. Use chat to coordinate details before starting the service.',
      infoMessage:
          'Chat is ready after matching. Start service when work begins.',
    );
  }

  if (isPreferredRequest) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Reply now',
      nextAction: 'Reply now so the customer can confirm you directly.',
      contextMessage:
          'The customer picked your profile first and is waiting for your response.',
      detailMessage:
          'You are the first partner this guest chose. Reply within $responseWindowLabel to protect the booking; marketplace partners inside $marketplaceRadiusLabel can still volunteer while the customer waits.',
      infoMessage:
          'The customer already chose you. Accept or decline this request within $responseWindowLabel.',
    );
  }

  if (joined) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Visible now',
      nextAction: 'Stay visible and wait for the customer to choose you.',
      contextMessage: hasPreferredProvider
          ? 'Another partner was chosen first. You are visible as a marketplace option.'
          : 'You are visible in this open request. The customer will pick the final partner.',
      detailMessage:
          'You are in the candidate list. Keep the app open and wait for customer selection.',
      infoMessage:
          'You are visible to the customer now. Wait for the final selection.',
    );
  }

  if (hasPreferredProvider) {
    final name = preferredProviderName == null || preferredProviderName.isEmpty
        ? 'the preferred partner'
        : preferredProviderName;
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Can participate',
      nextAction: 'Offer marketplace support if you can cover this request.',
      contextMessage:
          'Another partner was chosen first. You can still participate as an alternative option within the $marketplaceRadiusLabel marketplace radius.',
      detailMessage:
          'The guest is still waiting on $name. Participate now to appear as a marketplace option.',
      infoMessage:
          'Preferred partner: $name. Only partners inside $marketplaceRadiusLabel can participate in this request.',
    );
  }

  return ProviderRequestGuidance(
    modeLabel: modeLabel,
    priorityLabel: priorityLabel,
    roleLabel: roleLabel,
    decisionLabel: 'Can participate',
    nextAction: 'Participate in this open request to enter the customer choice list.',
    contextMessage:
        'This request is open to nearby partners inside $marketplaceRadiusLabel. The customer will pick the final partner.',
    detailMessage:
        'No preferred partner was set. Nearby partners can participate and wait for the guest selection.',
    infoMessage:
        'Customer is waiting and nearby partners may volunteer for this request.',
  );
}

int providerMatchingWindowMinutes(Map<String, dynamic> booking) {
  final policy = asMap(asMap(booking['metadata'])?['matchingPolicy']);
  final value = asNum(policy?['providerResponseWindowMinutes']) ??
      asNum(booking['providerResponseWindowMinutes']) ??
      asNum(booking['earlyAcceptMin']);
  final minutes = value?.round();
  if (minutes == null || minutes <= 0) {
    return 10;
  }
  return minutes;
}

int providerMarketplaceRadiusMeters(Map<String, dynamic> booking) {
  final policy = asMap(asMap(booking['metadata'])?['matchingPolicy']);
  final value = asNum(policy?['marketplaceRadiusMeters']) ??
      asNum(policy?['backupProviderRadiusMeters']) ??
      asNum(booking['marketplaceRadiusMeters']) ??
      asNum(booking['backupProviderRadiusMeters']);
  final meters = value?.round();
  if (meters == null || meters <= 0) {
    return 10000;
  }
  return meters;
}

String providerMatchingWindowText(Map<String, dynamic> booking) {
  final minutes = providerMatchingWindowMinutes(booking);
  return '$minutes min';
}

String providerMatchingWindowTagLabel(Map<String, dynamic> booking) {
  return '${providerMatchingWindowText(booking)} first-pick';
}

String providerMarketplaceRadiusText(Map<String, dynamic> booking) {
  final meters = providerMarketplaceRadiusMeters(booking);
  if (meters >= 1000) {
    final km = meters / 1000;
    final value = km == km.roundToDouble()
        ? km.toInt().toString()
        : km.toStringAsFixed(1);
    return '$value km';
  }
  return '$meters m';
}

String providerMarketplaceRadiusTagLabel(Map<String, dynamic> booking) {
  return '${providerMarketplaceRadiusText(booking)} marketplace';
}

@Deprecated('Use providerMarketplaceRadiusMeters. Reads legacy policy keys.')
int providerBackupRadiusMeters(Map<String, dynamic> booking) =>
    providerMarketplaceRadiusMeters(booking);

@Deprecated('Use providerMarketplaceRadiusText. Reads legacy policy keys.')
String providerBackupRadiusText(Map<String, dynamic> booking) =>
    providerMarketplaceRadiusText(booking);

@Deprecated('Use providerMarketplaceRadiusTagLabel. Reads legacy policy keys.')
String providerBackupRadiusTagLabel(Map<String, dynamic> booking) =>
    providerMarketplaceRadiusTagLabel(booking);
