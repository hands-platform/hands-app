import { NextResponse } from 'next/server';
import { adminGet, type AdminChatMessage } from '../../../../../../lib/admin-api';

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

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const payload = await adminGet<BookingChatMessagesResponse | null>(
    `/admin/bookings/${encodeURIComponent(id)}/chat-messages`,
    null,
  );

  if (!payload) {
    return NextResponse.json(
      { error: 'BOOKING_CHAT_MESSAGES_UNAVAILABLE' },
      { headers: { 'cache-control': 'no-store' }, status: 502 },
    );
  }

  return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
}
