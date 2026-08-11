import 'dart:async';
import 'dart:io';

import 'api_client.dart';

String customerErrorMessage(
  Object exception, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (exception is ApiException) {
    switch (exception.statusCode) {
      case 401:
        return 'Your session expired. Sign in again.';
      case 403:
        return 'This action is not available for your account.';
      case 404:
        return 'This information is no longer available.';
      case 409:
        return 'This information changed. Refresh and try again.';
      case 429:
        return 'Too many requests. Wait a moment and try again.';
      default:
        return exception.statusCode >= 500
            ? 'HANDS is temporarily unavailable. Please try again.'
            : fallback;
    }
  }
  if (exception is SocketException || exception is TimeoutException) {
    return 'Check your internet connection and try again.';
  }
  return fallback;
}
