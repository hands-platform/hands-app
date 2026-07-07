export function notificationFailureCodeLabel(failureCode: string) {
  if (failureCode === 'messaging/mismatched-credential') {
    return 'Firebase project mismatch';
  }
  if (
    failureCode === 'messaging/registration-token-not-registered' ||
    failureCode === 'messaging/invalid-registration-token'
  ) {
    return 'FCM token needs refresh';
  }
  if (failureCode === 'PUSH_PROVIDER_NOT_CONFIGURED') {
    return 'FCM credentials missing';
  }
  if (failureCode === 'messaging/internal-error') {
    return 'Firebase temporary service error';
  }
  if (failureCode === 'messaging/server-unavailable') {
    return 'Firebase temporarily unavailable';
  }
  return failureCode;
}

export function notificationFailureCodeClassName(failureCode: string) {
  return notificationFailureNeedsOperatorAction(failureCode) ? 'pill pill-warn' : 'pill pill-info';
}

export function notificationFailureRecoveryHint(failureCode: string | null | undefined) {
  if (!failureCode) {
    return null;
  }

  if (failureCode === 'messaging/mismatched-credential') {
    return 'Install Firebase Admin SDK JSON from the same Firebase project as the mobile app configs before retrying.';
  }
  if (failureCode === 'PUSH_PROVIDER_NOT_CONFIGURED') {
    return 'Enable FCM credentials or keep this route in-app-only before retrying push delivery.';
  }
  if (
    failureCode === 'messaging/registration-token-not-registered' ||
    failureCode === 'messaging/invalid-registration-token'
  ) {
    return 'Ask the user to reopen the app so it can register a fresh FCM token before retrying.';
  }
  if (failureCode === 'messaging/internal-error' || failureCode === 'messaging/server-unavailable') {
    return 'Retry after Firebase service status and local delivery workers are confirmed.';
  }

  return null;
}

export function notificationFailureRecoveryActionLabel(failureCode: string | null | undefined) {
  if (!failureCode) {
    return null;
  }

  if (failureCode === 'messaging/mismatched-credential') {
    return 'Next install matching Firebase Admin JSON';
  }
  if (failureCode === 'PUSH_PROVIDER_NOT_CONFIGURED') {
    return 'Next enable FCM credentials';
  }
  if (
    failureCode === 'messaging/registration-token-not-registered' ||
    failureCode === 'messaging/invalid-registration-token'
  ) {
    return 'Next refresh app token';
  }
  if (failureCode === 'messaging/internal-error' || failureCode === 'messaging/server-unavailable') {
    return 'Next retry after Firebase status check';
  }

  return null;
}

function notificationFailureNeedsOperatorAction(failureCode: string) {
  return (
    failureCode === 'messaging/mismatched-credential' ||
    failureCode === 'PUSH_PROVIDER_NOT_CONFIGURED' ||
    failureCode === 'messaging/registration-token-not-registered' ||
    failureCode === 'messaging/invalid-registration-token'
  );
}
