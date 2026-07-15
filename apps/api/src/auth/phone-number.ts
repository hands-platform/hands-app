export function normalizeVietnamPhoneIdentifier(value: string) {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s().-]/g, '');
  if (/^\+84\d{8,10}$/.test(compact)) {
    return compact;
  }
  if (/^84\d{8,10}$/.test(compact)) {
    return `+${compact}`;
  }
  if (/^0\d{8,10}$/.test(compact)) {
    return `+84${compact.slice(1)}`;
  }
  return trimmed;
}
