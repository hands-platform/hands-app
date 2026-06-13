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

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
