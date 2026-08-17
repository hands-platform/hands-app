import { NextRequest, NextResponse } from 'next/server';

import type { AdminBookingSettlementSnapshot } from '../../../../../../lib/admin-api';
import { adminGetResponse } from '../../../../../../lib/admin-api';
import { recordAdminOperatorActivity } from '../../../../../../lib/admin-operator-access';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import { buildCsvHeader, buildCsvRowContent } from '../../../../../../lib/csv-export';
import {
  BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS,
  buildBookingSettlementSnapshotCsvRow,
  buildBookingSettlementSnapshotExportApiHref,
  readBookingSettlementAuditFilters,
} from '../../../../../finance-tax/tax-settlement-page-model';

const EXPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const NO_STORE_HEADERS = { 'cache-control': 'no-store', pragma: 'no-cache' };

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const filters = readBookingSettlementAuditFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const upstream = await adminGetResponse(buildBookingSettlementSnapshotExportApiHref(filters));
  if (!upstream?.ok || !upstream.body) {
    if (upstream?.status === 413) {
      const payload = await readJsonRecord(upstream);
      return exportFailureResponse(filters, 'failed', {
        error: 'SETTLEMENT_AUDIT_EXPORT_TOO_LARGE',
        limit: numberField(payload, 'limit') ?? 100_000,
        totalRows: numberField(payload, 'totalRows') ?? 0,
      }, 413);
    }
    return exportFailureResponse(filters, 'failed', {
      error: 'SETTLEMENT_AUDIT_ROWS_UNAVAILABLE',
      upstreamStatus: upstream?.status ?? null,
    });
  }

  const reader = upstream.body.getReader();
  const metadata = await readExportMetadata(reader);
  if (!metadata) {
    await reader.cancel();
    return exportFailureResponse(filters, 'failed', { error: 'SETTLEMENT_AUDIT_EXPORT_INVALID' });
  }

  const generatedAt = new Date().toISOString();
  const context = {
    activeFilters: exportFilterDescription(filters),
    generatedAt,
    generatedBy: access.session?.sub ?? access.mode,
    sort: filters.sort ?? 'oldest',
    timezone: EXPORT_TIMEZONE,
    totalRows: metadata.totalRows,
  };
  const csvStream = bookingSettlementCsvStream(
    reader,
    metadata.decoder,
    metadata.remainder,
    context,
    async (receivedRows) => {
      if (receivedRows !== metadata.totalRows) {
        await recordAdminOperatorActivity(
          'finance.booking_settlement_audit.export_partial',
          '/finance-tax/booking-settlement-audit',
          {
            expectedRows: metadata.totalRows,
            filters: context.activeFilters,
            receivedRows,
            sort: context.sort,
          },
        );
        throw new Error('SETTLEMENT_AUDIT_EXPORT_INCOMPLETE');
      }
      await recordAdminOperatorActivity(
        'finance.booking_settlement_audit.export',
        '/finance-tax/booking-settlement-audit',
        {
          filters: context.activeFilters,
          generatedAt,
          rowCount: metadata.totalRows,
          sort: context.sort,
        },
      );
    },
  );

  return new NextResponse(csvStream, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-booking-settlement-audit-${filters.period ?? filters.range}-${filters.review}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}

type ExportContext = {
  activeFilters: string;
  generatedAt: string;
  generatedBy: string;
  sort: string;
  timezone: string;
  totalRows: number;
};

async function readExportMetadata(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return null;
    buffer += decoder.decode(value, { stream: true });
    const newline = buffer.indexOf('\n');
    if (newline < 0) continue;
    try {
      const envelope = JSON.parse(buffer.slice(0, newline)) as { totalRows?: unknown; type?: unknown };
      if (envelope.type !== 'metadata' || typeof envelope.totalRows !== 'number') return null;
      return { decoder, remainder: buffer.slice(newline + 1), totalRows: envelope.totalRows };
    } catch {
      return null;
    }
  }
}

function bookingSettlementCsvStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  initialBuffer: string,
  context: ExportContext,
  onComplete: (receivedRows: number) => Promise<void>,
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = initialBuffer;
      let receivedRows = 0;
      controller.enqueue(encoder.encode(`${buildCsvHeader(BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS)}\r\n`));

      const emitLines = (final = false) => {
        const lines = buffer.split('\n');
        buffer = final ? '' : (lines.pop() ?? '');
        for (const line of lines) {
          if (!line.trim()) continue;
          const envelope = JSON.parse(line) as { row?: AdminBookingSettlementSnapshot; type?: string };
          if (envelope.type !== 'row' || !envelope.row) throw new Error('SETTLEMENT_AUDIT_EXPORT_INVALID');
          controller.enqueue(encoder.encode(
            `${buildCsvRowContent(
              buildBookingSettlementSnapshotCsvRow(envelope.row, context),
              BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS,
            )}\r\n`,
          ));
          receivedRows += 1;
        }
      };

      try {
        emitLines();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          emitLines();
        }
        buffer += decoder.decode();
        if (buffer.trim()) buffer += '\n';
        emitLines(true);
        await onComplete(receivedRows);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function exportFilterDescription(filters: ReturnType<typeof readBookingSettlementAuditFilters>) {
  return [
    `range=${filters.range}`,
    `review=${filters.review}`,
    filters.paymentMethod ? `paymentMethod=${filters.paymentMethod}` : null,
    filters.period ? `period=${filters.period}` : null,
    filters.owner ? `owner=${filters.owner}` : null,
    filters.reason ? `reason=${filters.reason}` : null,
    filters.status ? `status=${filters.status}` : null,
    filters.q ? `q=${filters.q}` : null,
  ].filter(Boolean).join(';');
}

async function readJsonRecord(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function numberField(value: Record<string, unknown>, key: string) {
  return typeof value[key] === 'number' ? value[key] : null;
}

async function exportFailureResponse(
  filters: ReturnType<typeof readBookingSettlementAuditFilters>,
  outcome: 'failed' | 'partial',
  body: Record<string, number | string | null>,
  status = 502,
) {
  await recordAdminOperatorActivity(
    `finance.booking_settlement_audit.export_${outcome}`,
    '/finance-tax/booking-settlement-audit',
    { ...body, filters: exportFilterDescription(filters), sort: filters.sort ?? 'oldest' },
  );
  return NextResponse.json(body, { headers: NO_STORE_HEADERS, status });
}
