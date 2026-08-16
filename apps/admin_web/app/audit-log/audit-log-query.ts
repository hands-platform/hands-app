export const AUDIT_LOG_FILTER_QUERY_KEYS = [
  'q',
  'area',
  'outcome',
  'actorType',
  'severity',
  'objectType',
  'eventId',
  'correlationId',
  'requestId',
  'from',
  'to',
  'targetPrefix',
  'bucket',
] as const;

export type AuditLogFilterQueryKey = (typeof AUDIT_LOG_FILTER_QUERY_KEYS)[number];
