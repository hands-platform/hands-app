import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import type { BookingOperatorCommandQueue } from '../../../lib/booking-operator-command-queue';
import { bookingDetailOperatorPriorityBriefing } from './booking-detail-operator-priority-briefing';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    address: 'District 1 service address',
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-operator-priority-briefing',
    participants: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function commandQueue(
  command: BookingOperatorCommandQueue['commands'][number],
): BookingOperatorCommandQueue {
  return {
    commands: [command],
    labels: [],
    status: 'Action first',
    tone: command.tone === 'pill-success' ? 'pill-success' : 'pill-warn',
  };
}

function command(
  input: Partial<BookingOperatorCommandQueue['commands'][number]>,
): BookingOperatorCommandQueue['commands'][number] {
  return {
    action: { href: '#operator-command-queue', label: 'Open queue', type: 'link' },
    detail: 'Review the highest priority booking operation.',
    id: 'priority-command',
    label: 'OPS',
    owner: 'Operations',
    title: 'Review booking',
    tone: 'pill-warn',
    ...input,
  };
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    recordedAt: '2999-01-01T00:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

function financeFlag(title: string): AttentionFlag {
  return {
    action: 'Review finance evidence.',
    detail: 'Finance evidence needs operator review.',
    severity: 'medium',
    title,
  };
}

describe('bookingDetailOperatorPriorityBriefing', () => {
  it('summarizes final Partner, location, payment, and finance flags for first read', () => {
    const latestLocation = location();
    const briefing = bookingDetailOperatorPriorityBriefing({
      booking: booking({
        addressSnapshot: {
          addressText: 'District 3 service address',
          latitude: 10.762622,
          longitude: 106.660172,
        } as AdminBookingDetail['addressSnapshot'],
        chatRoom: { id: 'chat-room-1' } as AdminBookingDetail['chatRoom'],
        customerProfile: {
          user: {
            fullName: 'Mai Customer',
            phone: '+84000000001',
          },
        } as AdminBookingDetail['customerProfile'],
        participants: [{ id: 'participant-1' }] as AdminBookingDetail['participants'],
        payment: {
          method: 'CARD',
          providerRef: 'auth-1',
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
          locationSnapshots: [latestLocation],
        } as AdminBookingDetail['selectedProvider'],
        status: 'PROVIDER_ON_THE_WAY',
      }),
      closeoutReadiness: {
        helper: 'Payment capture is still open.',
        openItems: ['payment'],
        status: 'Open items',
      },
      financeFlags: [financeFlag('Capture required')],
      latestLocation,
      messageCount: 2,
      operatorCommandQueue: commandQueue(
        command({
          detail: 'Partner location and payment still need review.',
          owner: 'Dispatch',
          title: 'Review handoff',
        }),
      ),
    });

    expect(briefing.status).toBe('Action first');
    expect(briefing.rows.find((row) => row.label === 'Customer')).toMatchObject({
      helper: '+84000000001 / District 3 service address',
      value: 'Mai Customer',
    });
    expect(briefing.rows.find((row) => row.label === 'Partner state')).toMatchObject({
      helper: '1 participant record(s) / Final Partner: Linh Partner.',
      value: 'Linh Partner',
    });
    expect(briefing.rows.find((row) => row.label === 'Location record')).toMatchObject({
      helper: 'Location recorded without readable address / Updated just now',
      value: 'Recent',
    });
    expect(JSON.stringify(briefing)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
    expect(briefing.rows.find((row) => row.label === 'Payment')).toMatchObject({
      helper: 'Hold is active; capture after service completion.',
      value: 'CARD / AUTHORIZED',
    });
    expect(briefing.rows.find((row) => row.label === 'Closeout')).toMatchObject({
      helper: '1 finance check(s): Capture required',
      value: '1 item(s)',
    });
  });

  it('keeps missing active location and pending Partner choice visible', () => {
    const briefing = bookingDetailOperatorPriorityBriefing({
      booking: booking({
        customerProfile: {
          user: {
            fullName: null,
          },
        } as AdminBookingDetail['customerProfile'],
        status: 'MATCHED',
      }),
      closeoutReadiness: {
        helper: 'Closeout waits for service completion.',
        openItems: [],
        status: 'Not ready',
      },
      financeFlags: [],
      latestLocation: null,
      messageCount: 0,
      operatorCommandQueue: commandQueue(
        command({
          detail: 'Everything is currently visible.',
          owner: 'Operations',
          title: 'Monitor booking',
          tone: 'pill-success',
        }),
      ),
    });

    expect(briefing.status).toBe('Monitoring');
    expect(briefing.rows.find((row) => row.label === 'Customer')).toMatchObject({
      helper: 'No phone / District 1 service address',
      value: 'Customer',
    });
    expect(briefing.rows.find((row) => row.label === 'Partner state')).toMatchObject({
      value: 'Not selected',
    });
    expect(briefing.rows.find((row) => row.label === 'Location record')).toMatchObject({
      helper: 'No Partner location shared yet',
      value: 'Missing',
    });
    expect(briefing.steps[1]).toMatchObject({
      title: 'Keep Partner choice visible',
    });
  });
});
