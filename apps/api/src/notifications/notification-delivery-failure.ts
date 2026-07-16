export function notificationDeliveryFailureCode(response: unknown) {
  const responseRecord = readRecord(response);
  const body = readRecord(responseRecord?.body);
  const error = readRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = readRecord(details[0]);
  return (
    readString(responseRecord?.failureCode) ??
    readString(firstDetail?.errorCode) ??
    readString(body?.code) ??
    readString(error?.code)
  );
}

export function compactNotificationDeliveryResponse(response: unknown) {
  const responseRecord = readRecord(response);
  if (!responseRecord) return null;

  const body = readRecord(responseRecord.body);
  const error = readRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = readRecord(details[0]);
  const errors = Array.isArray(body?.errors)
    ? body.errors.map(String).filter(Boolean).join(', ')
    : null;
  const failureCode = notificationDeliveryFailureCode(response);
  const reason =
    readString(responseRecord.reason) ??
    readString(responseRecord.message) ??
    readString(body?.reason) ??
    readString(body?.message) ??
    readString(error?.message) ??
    readString(firstDetail?.errorMessage) ??
    readString(firstDetail?.errorCode) ??
    errors;
  const statusCode = readStatusCode(responseRecord.statusCode);
  const compact = {
    ...(failureCode ? { failureCode } : {}),
    ...(reason ? { reason } : {}),
    ...(statusCode !== null ? { statusCode } : {}),
  };

  return Object.keys(compact).length > 0 ? compact : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readStatusCode(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}
