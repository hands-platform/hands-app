import { NextResponse } from 'next/server';

import { adminGet, adminPostOrThrow, type AdminCalendarEvent } from '../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: Request) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const requestUrl = new URL(request.url);
  const query = new URLSearchParams();

  for (const key of ['from', 'take', 'to'] as const) {
    const value = requestUrl.searchParams.get(key)?.trim();
    if (value) {
      query.set(key, value);
    }
  }

  const events = await adminGet<AdminCalendarEvent[] | null>(
    `/admin/calendar-events${query.size ? `?${query.toString()}` : ''}`,
    null,
  );

  if (!events) {
    return NextResponse.json(
      { error: 'CALENDAR_EVENTS_LOAD_FAILED' },
      { headers: NO_STORE_HEADERS, status: 502 },
    );
  }

  return NextResponse.json(events, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  try {
    const body = await request.json();
    const event = await adminPostOrThrow<AdminCalendarEvent>('/admin/calendar-events', {
      ...(body && typeof body === 'object' ? body : {}),
      ...calendarOperatorPayload(access.session?.sub),
    });

    return NextResponse.json(event, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'CALENDAR_EVENT_CREATE_FAILED' }, { headers: NO_STORE_HEADERS, status: 400 });
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
