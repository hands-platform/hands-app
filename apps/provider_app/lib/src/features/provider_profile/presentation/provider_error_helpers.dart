import 'package:flutter/material.dart';

import '../../../core/api_client.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';

class ProviderActionBlockCopy {
  const ProviderActionBlockCopy({
    required this.title,
    required this.detail,
    required this.nextStep,
    required this.icon,
  });

  final String title;
  final String detail;
  final String nextStep;
  final IconData icon;
}

String providerAppErrorMessage(Object error) {
  if (error is ApiException) {
    final apiMessage = providerApiExceptionMessage(error.body);
    if (apiMessage != null) {
      return apiMessage;
    }
  }
  final raw = error.toString();
  final normalized = raw
      .replaceFirst('Bad state: ', '')
      .replaceFirst('Exception: ', '')
      .trim();
  if (isProviderDeviceBlockedMessage(normalized)) {
    return normalized.replaceFirst(
      'This device is blocked by admin review',
      'This device is blocked by HANDS admin review',
    );
  }
  if (isProviderAccountBlockedMessage(normalized)) {
    return normalized.replaceFirst(
      'This partner account is blocked by admin review',
      'This partner account is blocked by HANDS admin review',
    );
  }
  return normalized;
}

Map<String, dynamic>? providerApiExceptionWalletSummary(Object error) {
  if (error is! ApiException) {
    return null;
  }
  return providerWalletSummaryFromApiBody(error.body);
}

Map<String, dynamic>? providerWalletSummaryFromApiBody(
    Map<String, dynamic> body) {
  final directSummary = providerWalletSummaryCandidate(body);
  if (directSummary != null) {
    return directSummary;
  }

  final message = body['message'];
  if (message is Map) {
    return providerWalletSummaryCandidate(Map<String, dynamic>.from(message));
  }
  return null;
}

Map<String, dynamic>? providerWalletSummaryCandidate(
    Map<String, dynamic> value) {
  final code = value['code']?.toString().trim();
  final isWalletBlocked = code == 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT' ||
      value['walletBlocked'] == true ||
      value['walletSettlementRequired'] == true;
  if (!isWalletBlocked) {
    return null;
  }
  return value;
}

String? providerApiExceptionMessage(Map<String, dynamic> body) {
  final directCode = body['code']?.toString().trim();
  final directMessage = body['message'];
  final directReadable = providerReadableApiMessage(
    code: directCode,
    displayMessage: body['displayMessage'],
    message: directMessage,
    fallbackError: directMessage is Map ? null : body['error'],
  );
  if (directReadable != null) {
    return directReadable;
  }

  if (directMessage is Map) {
    final nestedCode = directMessage['code']?.toString().trim();
    final nestedReadable = providerReadableApiMessage(
      code: nestedCode,
      displayMessage: directMessage['displayMessage'],
      message: directMessage['message'],
      fallbackError: directMessage['error'],
    );
    if (nestedReadable != null) {
      return nestedReadable;
    }
  }

  final apiError = body['error'];
  if (apiError is String && apiError.trim().isNotEmpty) {
    return apiError.trim();
  }
  return null;
}

String? providerReadableApiMessage({
  required String? code,
  required Object? displayMessage,
  required Object? message,
  required Object? fallbackError,
}) {
  if (code == 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT') {
    if (displayMessage is String && displayMessage.trim().isNotEmpty) {
      return displayMessage.trim();
    }
    return providerWalletBlockFallbackReasonClean;
  }
  if (message is String && message.trim().isNotEmpty) {
    return message.trim();
  }
  if (fallbackError is String && fallbackError.trim().isNotEmpty) {
    return fallbackError.trim();
  }
  return null;
}

bool isProviderBlockedMessage(String value) {
  return isProviderDeviceBlockedMessage(value) ||
      isProviderAccountBlockedMessage(value);
}

ProviderActionBlockCopy? providerActionBlockCopy(String value) {
  final normalized = value.toLowerCase();
  if (normalized.contains('wallet') ||
      normalized.contains('settlement') ||
      normalized.contains('hands fee') ||
      normalized.contains('unpaid hands fees') ||
      normalized.contains('unpaid hands cash-service fees')) {
    return const ProviderActionBlockCopy(
      title: 'Fee settlement required',
      detail: providerWalletBlockFallbackReasonClean,
      nextStep:
          'Open Earnings, copy the settlement reference, then refresh wallet status after HANDS confirms payment.',
      icon: Icons.account_balance_wallet_outlined,
    );
  }
  if (normalized.contains('kyc must be approved')) {
    return const ProviderActionBlockCopy(
      title: 'KYC approval required',
      detail:
          'Your identity verification must be approved before receiving paid work.',
      nextStep:
          'Open Profile, submit CCCD and selfie verification, then wait for HANDS operations approval.',
      icon: Icons.badge_outlined,
    );
  }
  if (normalized.contains('required kyc document') ||
      normalized.contains('cccd') ||
      normalized.contains('selfie')) {
    return const ProviderActionBlockCopy(
      title: 'Identity document approval required',
      detail:
          'Required CCCD front, CCCD back, and selfie documents must be approved first.',
      nextStep:
          'Upload clear identity photos in Profile and ask HANDS operations to review them.',
      icon: Icons.assignment_ind_outlined,
    );
  }
  if (normalized.contains('bank account must be approved')) {
    return const ProviderActionBlockCopy(
      title: 'Bank account approval required',
      detail:
          'Your payout bank account must be approved before paid work starts.',
      nextStep:
          'Add or correct your bank account in Profile. HANDS must approve it before work starts.',
      icon: Icons.account_balance_outlined,
    );
  }
  if (normalized.contains('verification must be approved')) {
    return const ProviderActionBlockCopy(
      title: 'Partner verification required',
      detail:
          'Your partner profile verification must be approved before receiving work.',
      nextStep:
          'Complete the basic profile and wait for HANDS operations to approve your account.',
      icon: Icons.verified_user_outlined,
    );
  }
  if (normalized.contains('must be online')) {
    return const ProviderActionBlockCopy(
      title: 'Go online first',
      detail:
          'You must be online and sharing your current location before receiving requests.',
      nextStep:
          'Tap Go online, allow location permission, then refresh the request list.',
      icon: Icons.power_settings_new,
    );
  }
  return null;
}

bool isProviderDeviceBlockedMessage(String value) {
  return value.toLowerCase().contains('device is blocked');
}

bool isProviderAccountBlockedMessage(String value) {
  final normalized = value.toLowerCase();
  return normalized.contains('partner account is blocked') ||
      normalized.contains('account is blocked');
}
