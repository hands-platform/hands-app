export function normalizeNullable(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'service';
}

export function normalizeAuditReason(reason?: string) {
  const normalized = reason?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 500) : 'No reason provided by API caller';
}
