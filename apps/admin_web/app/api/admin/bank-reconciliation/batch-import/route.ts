import { NextResponse } from 'next/server';

import { AdminApiRequestError, adminPostOrThrow } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { isSameOriginMutationRequest } from '../../../../../lib/same-origin-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = { 'cache-control': 'no-store', pragma: 'no-cache' };

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) {
    return NextResponse.json(
      { error: 'CROSS_SITE_REQUEST_REJECTED' },
      { headers: NO_STORE_HEADERS, status: 403 },
    );
  }
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  try {
    const body = await request.json();
    const result = await adminPostOrThrow('/admin/bank-reconciliation/transactions/batch-import', body);
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const status = error instanceof AdminApiRequestError && error.status >= 400 && error.status < 500 ? 400 : 502;
    return NextResponse.json(
      { error: status === 400 ? 'BANK_BATCH_IMPORT_INVALID' : 'BANK_BATCH_IMPORT_UNAVAILABLE' },
      { headers: NO_STORE_HEADERS, status },
    );
  }
}
