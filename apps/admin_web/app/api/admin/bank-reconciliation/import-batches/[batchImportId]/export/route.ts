import { NextRequest, NextResponse } from 'next/server';

import type { AdminCompanyBankTransactionImportBatchDetail } from '../../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../../lib/admin-session';
import { buildBankStatementImportAuditCsv } from '../../../../../../../lib/bank-statement-import-audit-csv';

type RouteContext = {
  params: Promise<{ batchImportId: string }>;
};

const BATCH_IMPORT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: NextRequest, context: RouteContext) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const { batchImportId } = await context.params;
  if (!BATCH_IMPORT_ID_PATTERN.test(batchImportId)) {
    return NextResponse.json(
      { error: 'INVALID_BANK_STATEMENT_IMPORT_BATCH_ID' },
      { headers: NO_STORE_HEADERS, status: 400 },
    );
  }

  const batch = await adminGet<AdminCompanyBankTransactionImportBatchDetail | null>(
    `/admin/bank-reconciliation/import-batches/${encodeURIComponent(batchImportId)}`,
    null,
  );
  if (!batch) {
    return NextResponse.json(
      { error: 'BANK_STATEMENT_IMPORT_BATCH_NOT_FOUND' },
      { headers: NO_STORE_HEADERS, status: 404 },
    );
  }

  return new NextResponse(buildBankStatementImportAuditCsv(batch), {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-bank-statement-import-${batchImportId}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}
