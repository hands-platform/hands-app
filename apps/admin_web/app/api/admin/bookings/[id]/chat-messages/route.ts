import { NextResponse } from 'next/server';
import { adminGet, type AdminChatMessage } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BookingChatMessagesResponse = {
  readonly bookingId: string;
  readonly chatRoomId: string | null;
  readonly limit: number;
  readonly messages: readonly AdminChatMessage[];
  readonly truncated: boolean;
};

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

const NO_STORE_HEADERS = { 'cache-control': 'no-store' };

export async function GET(request: Request, context: RouteContext) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const { id } = await context.params;
  const payload = await adminGet<BookingChatMessagesResponse | null>(
    `/admin/bookings/${encodeURIComponent(id)}/chat-messages`,
    null,
  );

  if (!payload) {
    return NextResponse.json(
      { error: 'BOOKING_CHAT_MESSAGES_UNAVAILABLE' },
      { headers: NO_STORE_HEADERS, status: 502 },
    );
  }

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}
