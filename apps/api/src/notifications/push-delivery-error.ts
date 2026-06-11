export function firebaseFailureCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code);
  }

  return 'FCM_DELIVERY_FAILED';
}

export function isPermanentTokenFailure(failureCode: string) {
  return ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(
    failureCode,
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
