import { NextRequest, NextResponse } from 'next/server';

import type { AdminAuditExportResponse } from '../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { buildCsvContent } from '../../../../../lib/csv-export';
import { AUDIT_LOG_FILTER_QUERY_KEYS } from '../../../../audit-log/audit-log-query';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

const EXPORT_FILTER_KEYS = ['view', 'range', 'sort', ...AUDIT_LOG_FILTER_QUERY_KEYS] as const;

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const format = request.nextUrl.searchParams.get('format') === 'json' ? 'json' : 'csv';
  const params = new URLSearchParams({ format });
  for (const key of EXPORT_FILTER_KEYS) {
    const value = request.nextUrl.searchParams.get(key)?.trim();
    if (value) params.set(key, value);
  }
  const result = await adminGetResult<AdminAuditExportResponse>(
    `/admin/audit-logs/export?${params.toString()}`,
    emptyExport(format),
  );
  if (!result.ok) {
    const status = result.status && result.status >= 400 ? result.status : 502;
    return NextResponse.json(
      { error: 'Audit export could not be created. No success record was reported to the operator.' },
      { headers: NO_STORE_HEADERS, status },
    );
  }

  const filename = `hands-audit-log-${result.data.generatedAt.slice(0, 10)}.${format}`;
  const commonHeaders = {
    ...NO_STORE_HEADERS,
    'content-disposition': `attachment; filename="${filename}"`,
    'x-export-generated-at': result.data.generatedAt,
    'x-export-row-count': String(result.data.rowCount),
    'x-export-truncated': String(result.data.truncated),
  };
  if (format === 'json') {
    return new NextResponse(JSON.stringify(result.data.events, null, 2), {
      headers: { ...commonHeaders, 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const csv = buildCsvContent(result.data.events.map(csvAuditEvent), [
    'eventId', 'occurredAt', 'recordedAt', 'eventType', 'area', 'severity', 'outcome',
    'actorType', 'actorKey', 'actorLabel', 'objectType', 'objectId', 'objectLabel',
    'changeSummary', 'reasonCode', 'reasonText', 'correlationId', 'requestId', 'source',
    'payloadHash', 'integrity', 'payloadJson',
  ]);
  return new NextResponse(csv, {
    headers: { ...commonHeaders, 'content-type': 'text/csv; charset=utf-8' },
  });
}

function csvAuditEvent(event: AdminAuditExportResponse['events'][number]) {
  return {
    eventId: event.id,
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
    eventType: event.eventType,
    area: event.area,
    severity: event.severity,
    outcome: event.outcome,
    actorType: event.actor.type,
    actorKey: event.actor.key,
    actorLabel: event.actor.labelSnapshot,
    objectType: event.object.type,
    objectId: event.object.id,
    objectLabel: event.object.labelSnapshot,
    changeSummary: event.changeSummary,
    reasonCode: event.reason?.code,
    reasonText: event.reason?.text,
    correlationId: event.context.correlationId,
    requestId: event.context.requestId,
    source: event.context.source,
    payloadHash: event.payloadHash,
    integrity: event.integrity,
    payloadJson: JSON.stringify(event.payload),
  };
}

function emptyExport(format: 'csv' | 'json'): AdminAuditExportResponse {
  return {
    events: [],
    format,
    generatedAt: '',
    limit: 5_000,
    rowCount: 0,
    timezone: 'Asia/Ho_Chi_Minh',
    truncated: false,
  };
}
