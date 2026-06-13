const PERMANENT_TOKEN_FAILURE_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'UNREGISTERED',
]);

export function firebaseFailureCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code);
  }

  return 'FCM_DELIVERY_FAILED';
}

export function isPermanentTokenFailure(failureCode: string) {
  return (
    PERMANENT_TOKEN_FAILURE_CODES.has(failureCode) ||
    PERMANENT_TOKEN_FAILURE_CODES.has(failureCode.toUpperCase())
  );
}

export function isPermanentTokenError(failureCode: string, reason?: string) {
  if (isPermanentTokenFailure(failureCode)) {
    return true;
  }

  return (
    ['messaging/invalid-argument', 'INVALID_ARGUMENT'].includes(failureCode) &&
    Boolean(reason?.match(/registration token .*not a valid FCM registration token/i))
  );
}

export function safeErrorMessage(error: unknown, token?: string) {
  if (error instanceof Error) {
    return maskSensitivePushToken(
      error.message.replace(/registration token(?:\s*[:=]?\s*)[^ .,\]]+/gi, 'registration token [masked]'),
      token,
    );
  }

  return 'Unknown FCM delivery error.';
}

export function maskSensitivePushToken(message: string, token?: string) {
  return token ? message.split(token).join('[masked]') : message;
}
