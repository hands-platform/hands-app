import 'dart:async';
import 'dart:io';

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

String providerAppErrorMessage(
  Object? error, {
  String fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.',
}) {
  if (error is ApiException) {
    if (error.statusCode >= 500) {
      return 'HANDS tạm thời không khả dụng. Vui lòng thử lại.';
    }
    final apiMessage = providerApiExceptionMessage(error.body);
    if (apiMessage != null) {
      return providerActionBlockCopy(apiMessage)?.detail ?? apiMessage;
    }
    switch (error.statusCode) {
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Tài khoản của bạn không thể thực hiện thao tác này.';
      case 404:
        return 'Thông tin này không còn khả dụng.';
      case 409:
        return 'Thông tin đã thay đổi. Hãy làm mới và thử lại.';
      case 429:
        return 'Có quá nhiều yêu cầu. Hãy chờ một lúc rồi thử lại.';
      default:
        return fallback;
    }
  }
  if (error is SocketException || error is TimeoutException) {
    return 'Kiểm tra kết nối Internet và thử lại.';
  }
  final raw = error.toString();
  final normalized = raw
      .replaceFirst('Bad state: ', '')
      .replaceFirst('Exception: ', '')
      .trim();
  if (isProviderDeviceBlockedMessage(normalized)) {
    return 'Thiết bị này đang bị HANDS tạm khóa để xem xét.';
  }
  if (isProviderAccountBlockedMessage(normalized)) {
    return 'Tài khoản đối tác này đang bị HANDS tạm khóa để xem xét.';
  }
  return fallback;
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
  if (normalized.contains('bank account must be approved') ||
      normalized.contains('thông tin ngân hàng được kiểm tra')) {
    return const ProviderActionBlockCopy(
      title: 'Cần thông tin ngân hàng cho ví',
      detail:
          'Thông tin ngân hàng được kiểm tra cho yêu cầu rút hoặc nộp tiền vào ví, không ảnh hưởng đến việc nhận công việc.',
      nextStep:
          'Mở mục Thu nhập, chọn rút tiền hoặc báo cáo khoản nộp rồi thêm hoặc sửa thông tin ngân hàng khi được yêu cầu.',
      icon: Icons.account_balance_outlined,
    );
  }
  if (value == providerWalletBlockFallbackReasonClean ||
      normalized.contains('wallet') ||
      normalized.contains('settlement') ||
      normalized.contains('hands fee') ||
      normalized.contains('unpaid hands fees') ||
      normalized.contains('unpaid hands cash-service fees')) {
    return const ProviderActionBlockCopy(
      title: 'Cần thanh toán phí',
      detail: providerWalletBlockFallbackReasonClean,
      nextStep:
          'Mở mục Thu nhập, sao chép mã thanh toán và làm mới trạng thái ví sau khi HANDS xác nhận.',
      icon: Icons.account_balance_wallet_outlined,
    );
  }
  if (normalized.contains('kyc must be approved') ||
      normalized.contains('xác minh danh tính phải được phê duyệt')) {
    return const ProviderActionBlockCopy(
      title: 'Cần phê duyệt KYC',
      detail:
          'Xác minh danh tính phải được phê duyệt trước khi nhận công việc có trả phí.',
      nextStep:
          'Mở mục Hồ sơ, gửi CCCD và ảnh chân dung rồi chờ HANDS phê duyệt.',
      icon: Icons.badge_outlined,
    );
  }
  if (normalized.contains('required kyc document') ||
      normalized.contains('mặt trước cccd') ||
      normalized.contains('cccd') ||
      normalized.contains('selfie')) {
    return const ProviderActionBlockCopy(
      title: 'Cần phê duyệt giấy tờ danh tính',
      detail:
          'Mặt trước CCCD, mặt sau CCCD và ảnh chân dung phải được phê duyệt trước.',
      nextStep:
          'Tải ảnh danh tính rõ nét trong mục Hồ sơ và chờ HANDS xem xét.',
      icon: Icons.assignment_ind_outlined,
    );
  }
  if (normalized.contains('verification must be approved') ||
      normalized.contains('hồ sơ đối tác phải được phê duyệt')) {
    return const ProviderActionBlockCopy(
      title: 'Cần xác minh đối tác',
      detail: 'Hồ sơ đối tác phải được phê duyệt trước khi nhận công việc.',
      nextStep: 'Hoàn tất hồ sơ cơ bản và chờ HANDS phê duyệt tài khoản.',
      icon: Icons.verified_user_outlined,
    );
  }
  if (normalized.contains('must be online') ||
      normalized.contains('bạn phải trực tuyến')) {
    return const ProviderActionBlockCopy(
      title: 'Hãy bật trực tuyến trước',
      detail:
          'Bạn phải trực tuyến và chia sẻ vị trí hiện tại trước khi nhận yêu cầu.',
      nextStep:
          'Chọn Bật trực tuyến, cho phép truy cập vị trí rồi làm mới danh sách yêu cầu.',
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
