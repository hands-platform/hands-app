import { NextResponse } from 'next/server';

import { AdminApiRequestError, adminPostOrThrow } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = { 'cache-control': 'no-store', pragma: 'no-cache' };

export async function POST(request: Request) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  try {
    const body = await request.json();
    const preview = await adminPostOrThrow('/admin/bank-reconciliation/transactions/batch-preview', body);
    return NextResponse.json(preview, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const status = error instanceof AdminApiRequestError && error.status >= 400 && error.status < 500 ? 400 : 502;
    return NextResponse.json(
      { error: status === 400 ? 'BANK_BATCH_PREVIEW_INVALID' : 'BANK_BATCH_PREVIEW_UNAVAILABLE' },
      { headers: NO_STORE_HEADERS, status },
    );
  }
}
