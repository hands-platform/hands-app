import { NextResponse } from 'next/server';

import {
  adminDeleteWithBodyOrThrow,
  adminPatchOrThrow,
  type AdminCalendarEvent,
} from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { isSameOriginMutationRequest } from '../../../../../lib/same-origin-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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
    const { id } = await context.params;
    const body = await request.json();
    const event = await adminPatchOrThrow<AdminCalendarEvent>(`/admin/calendar-events/${encodeURIComponent(id)}`, {
      ...(body && typeof body === 'object' ? body : {}),
      ...calendarOperatorPayload(access.session?.sub),
    });

    return NextResponse.json(event, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'CALENDAR_EVENT_UPDATE_FAILED' }, { headers: NO_STORE_HEADERS, status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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
    const { id } = await context.params;
    const result = await adminDeleteWithBodyOrThrow<{ id: string; ok: true }>(
      `/admin/calendar-events/${encodeURIComponent(id)}`,
      calendarOperatorPayload(access.session?.sub),
    );

    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'CALENDAR_EVENT_DELETE_FAILED' }, { headers: NO_STORE_HEADERS, status: 400 });
  }
}

function calendarOperatorPayload(identity: string | undefined) {
  const operatorIdentity = identity ?? process.env.ADMIN_WEB_LOGIN_EMAIL?.trim() ?? 'admin-web';

  return {
    operatorIdentity,
    operatorName: displayOperatorName(operatorIdentity),
  };
}

function displayOperatorName(identity: string) {
  const [name] = identity.split('@');

  return (
    name
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || identity
  );
}
