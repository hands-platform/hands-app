import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffBookingQueueSection } from './operations-handoff-booking-queue-section';

describe('OperationsHandoffBookingQueueSection', () => {
  it('uses the shared AdminFormControlLink atom for booking queue actions', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-booking-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTableSection');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTableScroll');
    expect(source).not.toContain(
      'admin-mb-16 operations-handoff-booking-queue-card vuexy-booking-table-card vuexy-booking-table-group',
    );
    expect(source).not.toContain('<Link className="button button-secondary"');
    expect(source).not.toContain('<div className="admin-table-scroll">');
  });

  it('renders booking handoff rows and monitor links', () => {
    const section = OperationsHandoffBookingQueueSection({
      bookings: [
        {
          chatClass: 'pill pill-success',
          chatLabel: 'Chat archived',
          createdAt: '2026-06-14T00:00:00.000Z',
          customerAvatarStatus: 'working',
          customerHref: '/customers/customer-mai',
          customerName: 'Customer Mai',
          customerPhone: '+84900000001',
          id: 'booking-1234567890',
          nextAction: 'Open booking detail for the latest factual state.',
          partnerAvatarStatus: 'working',
          partnerDetail: 'Selected Partner',
          partnerHref: '/partners/partner-linh',
          partnerName: 'Partner Linh',
          paymentLabel: 'MOMO / CAPTURED / 150.000 VND',
          status: 'MATCHED',
          statusClass: 'pill pill-info',
          updatedAt: '2026-06-14T00:10:00.000Z',
          walletLabel: 'Wallet effect 120.000 VND',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Booking handoff queue');
    expect(rendered).toContain('Customer Mai');
    expect(rendered).toContain('Partner Linh');
    expect(rendered).toContain('MOMO / CAPTURED / 150.000 VND');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings?view=attention',
        '/chat-archive',
        '/bookings/booking-1234567890',
        '/customers/customer-mai',
        '/partners/partner-linh',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-avatar-status-dot is-working',
        'card admin-section vuexy-booking-table-card vuexy-booking-table-group operations-handoff-booking-queue-card admin-mb-16',
        'table-link',
        'table vuexy-data-table vuexy-booking-table',
        'vuexy-booking-person',
      ]),
    );
  });

  it('renders the empty state when there are no booking rows', () => {
    const rendered = textContent(OperationsHandoffBookingQueueSection({ bookings: [] }));

    expect(rendered).toContain('No active booking handoff rows.');
  });
});
