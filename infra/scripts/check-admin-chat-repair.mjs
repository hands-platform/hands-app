import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const files = {
  controller: 'apps/api/src/admin/admin.controller.ts',
  service: 'apps/api/src/admin/admin.service.ts',
  actions: 'apps/admin_web/app/bookings/[id]/actions.ts',
  detailPage: 'apps/admin_web/app/bookings/[id]/page.tsx',
  actionSections: 'apps/admin_web/app/bookings/[id]/booking-action-status-sections.tsx',
};

const contents = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, readFileSync(join(root, file), 'utf8')]),
);

const checks = [
  {
    name: 'admin controller exposes repair endpoint',
    ok:
      contents.controller.includes("@Post('bookings/:id/repair-chat-room')") &&
      contents.controller.includes('repairBookingChatRoom('),
  },
  {
    name: 'admin service can repair chat room',
    ok:
      contents.service.includes('async repairBookingChatRoom(') &&
      contents.service.includes('booking.chat_room.repair') &&
      contents.service.includes('chatRoom: { upsert: { create: {}, update: {} } }'),
  },
  {
    name: 'booking detail server action calls repair endpoint',
    ok:
      contents.actions.includes('export async function repairBookingChatRoom') &&
      contents.actions.includes('/repair-chat-room') &&
      contents.actions.includes("revalidatePath('/chat-archive')"),
  },
  {
    name: 'booking detail page wires chat repair form',
    ok:
      contents.detailPage.includes('chatRepair') &&
      contents.detailPage.includes('BookingActionStatusSections') &&
      contents.actionSections.includes('Repair chat room') &&
      contents.actionSections.includes('repairBookingChatRoom'),
  },
];

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\nAdmin chat repair contract failed: ${failed.length} missing check(s).`);
  process.exit(1);
}
