import 'package:flutter/material.dart';

bool providerPublicMediaIsReviewable(Map<String, dynamic> item) {
  final purpose = item['purpose']?.toString();
  final visibility = item['visibility']?.toString();
  final uploadStatus = item['uploadStatus']?.toString();
  return visibility == 'PUBLIC' &&
      uploadStatus == 'UPLOADED' &&
      (purpose == 'PROFILE_IMAGE' ||
          purpose == 'profile-image' ||
          purpose == 'PROVIDER_GALLERY' ||
          purpose == 'provider-gallery');
}

String providerPublicMediaReviewStatus(Map<String, dynamic> item) {
  final value = item['reviewStatus']?.toString();
  if (value == 'APPROVED' || value == 'REJECTED') {
    return value!;
  }
  return 'PENDING_REVIEW';
}

String providerPublicMediaPurposeLabel(String? purpose) {
  switch (purpose) {
    case 'PROFILE_IMAGE':
    case 'profile-image':
      return 'Ảnh hồ sơ';
    case 'PROVIDER_GALLERY':
    case 'provider-gallery':
      return 'Ảnh công việc';
    default:
      return 'Ảnh công khai';
  }
}

String providerPublicMediaReviewLabel(String status) {
  switch (status) {
    case 'APPROVED':
      return 'Đã duyệt và hiển thị với khách hàng';
    case 'REJECTED':
      return 'Cần chỉnh sửa trước khi hiển thị với khách hàng';
    default:
      return 'Đang chờ HANDS xét duyệt';
  }
}

IconData providerPublicMediaReviewIcon(String status) {
  switch (status) {
    case 'APPROVED':
      return Icons.check_circle_outline;
    case 'REJECTED':
      return Icons.report_problem_outlined;
    default:
      return Icons.hourglass_top_outlined;
  }
}

Color providerPublicMediaReviewColor(String status) {
  switch (status) {
    case 'APPROVED':
      return Colors.green.shade700;
    case 'REJECTED':
      return Colors.red.shade700;
    default:
      return Colors.orange.shade700;
  }
}
