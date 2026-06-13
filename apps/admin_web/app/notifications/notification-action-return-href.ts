export function notificationActionReturnHref(formData: FormData) {
  return sanitizeNotificationReturnHref(readOptionalFormString(formData, 'returnHref'));
}

export function sanitizeNotificationReturnHref(value: string | null) {
  if (!value) {
    return '/notifications';
  }

  const normalized = new URL(value, 'http://admin.local');
  if (normalized.origin !== 'http://admin.local' || normalized.pathname !== '/notifications') {
    return '/notifications';
  }

  return `${normalized.pathname}${normalized.search}`;
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}
