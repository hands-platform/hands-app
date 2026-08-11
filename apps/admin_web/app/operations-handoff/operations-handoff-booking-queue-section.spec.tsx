import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffBookingQueueSection } from './operations-handoff-booking-queue-section';

describe('OperationsHandoffBookingQueueSection', () => {
  it('uses the shared AdminFormControlLink atom for booking queue actions', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-booking-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTableSection');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTableScroll');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass(booking.statusClass)');
    expect(source).not.toContain('statusBadgeToneFromPillClass(booking.chatClass)');
    expect(source).not.toContain(
      'admin-mb-16 operations-handoff-booking-queue-card vuexy-booking-table-card vuexy-booking-table-group',
    );
    expect(source).not.toContain('<Link className="button button-secondary"');
    expect(source).not.toContain('<div className="admin-table-scroll">');
    expect(source).not.toContain('<span className={booking.statusClass}>{booking.status}</span>');
    expect(source).not.toContain('<span className={booking.chatClass}>{booking.chatLabel}</span>');
  });

  it('renders booking history rows and monitor links', () => {
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
          reviewReason: 'Matched booking still needs service-start confirmation.',
          status: 'MATCHED',
          statusClass: 'pill pill-info',
          updatedAt: '2026-06-14T00:10:00.000Z',
          walletLabel: 'Wallet effect 120.000 VND',
        },
      ],
      pagination: pagination(1),
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Booking history queue');
    expect(rendered).toContain('Customer Mai');
    expect(rendered).toContain('Partner Linh');
    expect(rendered).toContain('MOMO / CAPTURED / 150.000 VND');
    expect(rendered).toContain('Matched booking still needs service-start confirmation.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings?view=attention',
        '/bookings?view=chat',
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
        'table vuexy-data-table vuexy-booking-table admin-data-table',
        'vuexy-booking-person',
      ]),
    );
  });

  it('renders the empty state when there are no booking rows', () => {
    const rendered = textContent(OperationsHandoffBookingQueueSection({ bookings: [], pagination: pagination(0) }));

    expect(rendered).toContain('No booking history rows.');
  });

  it('renders the server-provided page without slicing it a second time', () => {
    const section = OperationsHandoffBookingQueueSection({
      bookings: [
        {
          chatClass: 'pill pill-info',
          chatLabel: 'No chat',
          createdAt: '2026-06-14T00:00:00.000Z',
          customerAvatarStatus: 'offline',
          customerHref: '/customers/customer-4',
          customerName: 'Customer 4',
          customerPhone: '+84900000004',
          id: 'booking-page-two',
          nextAction: 'Open booking detail.',
          partnerAvatarStatus: 'offline',
          partnerDetail: 'No Partner selected',
          partnerHref: '/partners',
          partnerName: 'Unassigned',
          paymentLabel: 'No payment',
          reviewReason: 'Historical record.',
          status: 'COMPLETED',
          statusClass: 'pill pill-success',
          updatedAt: '2026-06-14T00:10:00.000Z',
          walletLabel: 'No wallet effect',
        },
      ],
      pagination: {
        ...pagination(12),
        activePage: 2,
      },
    });
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('Customer 4');
    expect(markup).toContain('Showing 4 to 4 of 12 booking rows');
  });
});

function pagination(totalRows: number) {
  return {
    activePage: 1,
    ariaLabel: 'Operations booking history pagination',
    hrefForPage: (page: number) => `/operations-handoff?details=all&bookingPage=${page}`,
    itemLabel: 'booking rows',
    totalRows,
  };
}
