export type NotificationDataScope = 'production' | 'synthetic' | 'unknown';
export type NotificationDeliveryIntent = 'IN_APP_ONLY' | 'PUSH' | 'PUSH_AND_IN_APP';

export function notificationDataWithDeliveryContract(
  data: unknown,
  deliveryIntent: NotificationDeliveryIntent,
  nodeEnv = process.env.NODE_ENV,
) {
  return {
    ...notificationDataWithRuntimeScope(data, nodeEnv),
    deliveryIntent,
  };
}

export function notificationDataWithRuntimeScope(data: unknown, nodeEnv = process.env.NODE_ENV) {
  const record = data && typeof data === 'object' && !Array.isArray(data)
    ? { ...(data as Record<string, unknown>) }
    : {};
  const explicitScope = readNotificationDataScope(record.dataScope);
  const scope = hasSyntheticMarker(record)
    ? 'synthetic'
    : explicitScope ?? notificationRuntimeDataScope(nodeEnv);

  return { ...record, dataScope: scope };
}

export function notificationRuntimeDataScope(nodeEnv = process.env.NODE_ENV): NotificationDataScope {
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'test') return 'synthetic';
  return 'unknown';
}

function readNotificationDataScope(value: unknown): NotificationDataScope | null {
  return value === 'production' || value === 'synthetic' || value === 'unknown' ? value : null;
}

function hasSyntheticMarker(record: Record<string, unknown>) {
  return record.smokeFixture === true || record.smoke === true || record.fixture === true;
}
