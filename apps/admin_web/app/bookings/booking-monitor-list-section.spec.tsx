import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBooking } from '../../lib/admin-api';
import { normalizedText } from './booking-section-test-utils';
import {
  BookingMonitorListSection,
  BookingPostMatchCancellationChatLayer,
  type BookingMonitorListRow,
} from './booking-monitor-list-section';

const KOREAN_VIETNAM_COUNTRY = '\uBCB0\uD2B8\uB0A8';

describe('BookingMonitorListSection', () => {
  it('renders the live operations workspace as one compact server-paginated table', () => {
    const markup = renderToStaticMarkup(
      <BookingMonitorListSection
        emptyMessage="No bookings match filters."
        operationsWorkspace={{
          description: 'Stalled live bookings that need review.',
          detailPagePath: '/bookings',
          detailView: 'attention',
          title: 'Needs action',
          tone: 'warning',
        }}
        rows={[
          bookingRowFixture({
            customerName: 'Live Customer',
            id: 'booking-live-1',
            openedDateLabel: '18 Jul 2026, 12:00',
            status: 'OPEN_MATCHING',
            statusChangedAt: '2026-07-18T05:00:00.000Z',
          }),
        ]}
        returnHref="/bookings?view=attention&sort=oldest&page=2"
        serverPagination={{
          hrefForPage: (page) => `/bookings?view=attention&page=${page}`,
          page: 2,
          pageSize: 20,
          totalPages: 3,
          totalRows: 43,
        }}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Needs action');
    expect(rendered).toContain('43 bookings');
    expect(rendered).toContain('Showing 21 to 21 of 43 entries');
    expect(rendered).toContain('Next action');
    expect(rendered).toContain('Last activity');
    expect(rendered).toContain('Matching opened 12m ago');
    expect(markup).toContain('vuexy-booking-operations-table');
    expect(markup).toContain('>Booking · Customer</th>');
    expect(markup).toContain('>Partner · Matching</th>');
    expect(markup).toContain('>Service · Area</th>');
    expect(markup.indexOf('>Status</th>')).toBeLessThan(markup.indexOf('>Last activity</th>'));
    expect(markup.indexOf('>Last activity</th>')).toBeLessThan(markup.indexOf('>Next action</th>'));
    expect(markup).toContain('href="/bookings?view=attention&amp;page=3"');
    expect(markup).toContain(
      'href="/bookings/booking-live-1?returnTo=%2Fbookings%3Fview%3Dattention%26sort%3Doldest%26page%3D2#booking-command-decision-strip"',
    );
    expect(rendered).not.toContain('Live / Today Bookings');
    expect(rendered).not.toContain('Live In Progress');
  });

  it('renders booking records as a five-column historical lookup table', () => {
    const fixture = bookingRowFixture({
      closedAt: '2026-07-18T05:20:00.000Z',
      closedByRole: 'PROVIDER',
      closedReason: 'provider_cancelled',
      closureState: {
        detail: 'Provider cancelled · 18 Jul 2026, 12:20',
        label: 'Closed by Partner',
        tone: 'pill-info',
      },
      customerName: 'Records Customer',
      id: 'booking-record-1',
      openedDateLabel: '18 Jul 2026, 12:00',
      selectedProviderId: 'partner-record-1',
      selectedProviderName: 'Records Partner',
      status: 'CANCELLED',
      statusChangedAt: '2026-07-18T05:20:00.000Z',
    });
    const row: BookingMonitorListRow = {
      ...fixture,
      booking: {
        ...fixture.booking,
        customerProfile: {
          ...fixture.booking.customerProfile,
          user: {
            ...fixture.booking.customerProfile?.user,
            phone: '+84******00',
          },
        },
        payment: { amount: 300_000, currency: 'VND', method: 'CARD', status: 'RELEASED' },
      } as AdminBooking,
      serviceOptionLabel: 'Aroma massage / 60 min',
      servicePayoutLabel: 'Payout 240.000 VND / fee 60.000 VND',
      servicePriceLabel: 'Customer price 300.000 VND / Minimum 250.000 VND',
    };

    const markup = renderToStaticMarkup(
      <BookingMonitorListSection
        emptyMessage="No records."
        operationsWorkspace={{
          description: 'Historical booking outcomes in the selected period.',
          detailPagePath: '/bookings',
          detailView: 'all',
          title: 'Booking records',
          tone: 'neutral',
        }}
        returnHref="/bookings?view=all&dateRange=30d"
        rows={[row]}
      />,
    );
    const rendered = normalizedText(markup);

    expect(markup.match(/<th(?:\s|>)/g)).toHaveLength(5);
    expect(markup).toContain('vuexy-booking-records-table');
    expect(rendered).toContain('Status · Closed');
    expect(rendered).toContain('Partner · Service');
    expect(rendered).toContain('Area · Payment');
    expect(rendered).toContain('Follow-up');
    expect(rendered).toContain('Closed by Partner');
    expect(rendered).toContain('Partner minimum 250.000 VND');
    expect(rendered).toContain('Partner payout 240.000 VND');
    expect(rendered).toContain('+84******00');
    expect(rendered).toContain('No follow-up');
    expect(rendered).not.toContain('Last activity');
    expect(rendered).not.toContain('Provider cancelled · 18 Jul 2026, 12:20');
  });

  it('renders closeout evidence and one accessible queue action without matching noise', () => {
    const fixture = bookingRowFixture({
      customerName: 'Closeout Customer',
      id: 'booking-closeout-1',
      openedDateLabel: '5 Aug 2026, 18:00',
      selectedProviderId: 'partner-closeout-1',
      selectedProviderName: 'Closeout Partner',
      status: 'COMPLETED',
      statusChangedAt: '5 Aug 2026, 18:18',
    });
    const row: BookingMonitorListRow = {
      ...fixture,
      booking: {
        ...fixture.booking,
        earning: {
          currency: 'VND',
          netAmount: 140_000,
          platformFeeLogs: [],
          status: 'PENDING',
          taxLogs: [],
          walletLedgerEntries: [],
        },
        payment: {
          amount: 200_000,
          currency: 'VND',
          method: 'CARD',
          providerRef: null,
          refunds: [],
          status: 'CAPTURED',
        },
      } as unknown as AdminBooking,
      issueChips: [
        { label: 'Platform fee missing', tone: 'pill-warn' },
        { label: 'Tax missing', tone: 'pill-warn' },
      ],
      nextActionHelper: 'Open booking finance evidence and verify the missing platform fee record.',
      nextActionLabel: 'Review platform fee record',
      terminalWaitingLabel: 'waiting 4h',
    };
    const markup = renderToStaticMarkup(
      <BookingMonitorListSection
        emptyMessage="No records."
        operationsWorkspace={{
          description: 'Completed services with one or more missing closeout records.',
          detailPagePath: '/bookings/completed',
          detailView: 'closeout',
          title: 'Closeout ops',
          tone: 'warning',
        }}
        returnHref="/bookings/completed?view=closeout"
        rows={[row]}
      />,
    );
    const rendered = normalizedText(markup);

    for (const header of [
      'Priority · Issue',
      'Booking · Customer',
      'Completed service',
      'Payment',
      'Partner · Closeout',
      'Next action',
    ]) {
      expect(rendered).toContain(header);
    }
    expect(rendered).toContain('waiting 4h');
    expect(rendered).toContain('Platform fee missing');
    expect(rendered).not.toContain('Gateway ref missing');
    expect(rendered).toContain('Closeout Partner');
    expect(rendered).toContain('Fee missing');
    expect(rendered).toContain('Tax missing');
    expect(rendered).toContain('Wallet missing');
    expect(rendered).toContain('Review platform fee record');
    expect(markup).toContain('booking-closeout-operations-table');
    expect(markup).toContain(
      'href="/bookings/booking-closeout-1?returnTo=%2Fbookings%2Fcompleted%3Fview%3Dcloseout#booking-outcome-review"',
    );
    expect(rendered).not.toContain('participant');
    expect(markup).not.toContain('admin-avatar-status-dot');
  });

  it('renders cash commission direction without a gateway issue or duplicate price prefix', () => {
    const fixture = bookingRowFixture({
      customerName: 'Cash Customer',
      id: 'booking-cash-1',
      openedDateLabel: '7 Aug 2026, 10:00',
      selectedProviderId: 'partner-cash-1',
      selectedProviderName: 'Cash Partner',
      status: 'COMPLETED',
      statusChangedAt: '2026-08-07T03:00:00.000Z',
    });
    const row: BookingMonitorListRow = {
      ...fixture,
      booking: {
        ...fixture.booking,
        earning: {
          currency: 'VND',
          netAmount: -80_000,
          platformFeeLogs: [{}],
          status: 'PENDING',
          taxLogs: [{}],
          walletLedgerEntries: [{}],
        },
        payment: { amount: 400_000, currency: 'VND', method: 'CASH', status: 'CAPTURED' },
      } as unknown as AdminBooking,
      cashDebtAmountLabel: '80.000 VND',
      cashDebtNeedsOps: true,
      issueChips: [{ label: 'Cash commission due', tone: 'pill-danger' }],
      nextActionHelper: 'Open booking finance evidence and reconcile the commission owed to HANDS.',
      nextActionLabel: 'Settle cash commission',
      servicePriceLabel: 'Customer price 400.000 VND / Minimum 300.000 VND',
    };
    const markup = renderToStaticMarkup(
      <BookingMonitorListSection
        emptyMessage="No records."
        operationsWorkspace={{
          description: 'Includes payment exceptions.',
          detailPagePath: '/bookings/completed',
          detailView: 'payment',
          title: 'All payment exceptions',
          tone: 'warning',
        }}
        rows={[row]}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Cash commission due');
    expect(rendered).toContain('Partner owes HANDS 80.000 VND');
    expect(rendered).toContain('Settle cash commission');
    expect(rendered).not.toContain('Gateway ref missing');
    expect(rendered.match(/Customer price/g)).toHaveLength(1);
    expect(rendered).not.toContain('Minimum 300.000 VND');
  });

  it('keeps saved references compact and expired history neutral', () => {
    const fixture = bookingRowFixture({
      customerName: 'History Customer',
      id: 'booking-expired-1',
      openedDateLabel: '7 Aug 2026, 10:00',
      status: 'EXPIRED',
      statusChangedAt: '2026-08-07T03:00:00.000Z',
    });
    const row: BookingMonitorListRow = {
      ...fixture,
      booking: {
        ...fixture.booking,
        payment: {
          amount: 200_000,
          currency: 'VND',
          method: 'CARD',
          providerRef: 'gateway-reference-secret',
          status: 'RELEASED',
        },
      } as unknown as AdminBooking,
      issueChips: [{ label: 'Expired record', tone: 'pill-neutral' }],
      nextActionHelper: 'Review retained terminal evidence.',
      nextActionLabel: 'Open expired record',
    };
    const markup = renderToStaticMarkup(
      <BookingMonitorListSection
        emptyMessage="No records."
        operationsWorkspace={{
          description: 'Expired booking records closed in the selected period.',
          detailPagePath: '/bookings/completed',
          detailView: 'expired',
          title: 'Expired records',
          tone: 'neutral',
        }}
        rows={[row]}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Reference saved');
    expect(markup).not.toContain('gateway-reference-secret');
    expect(rendered).toContain('Expired record');
    expect(rendered).toContain('Open expired record');
    expect(markup).toContain('pill pill-neutral">Record</span>');
    expect(markup).not.toContain('pill pill-warn">Action</span>');
  });

  it('keeps the closeout table within its container at desktop widths', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.booking-monitor .table.booking-closeout-operations-table');
    expect(css).toContain('.booking-monitor .booking-closeout-operations-table .vuexy-booking-next-action-cell');
    expect(css).toContain('.booking-completed-filter-panel > .admin-filter-panel-body');
    expect(css).toContain('.booking-completed-filter-panel .admin-queue-age-sort-controls');
    expect(css).toContain('.admin-page-header:has(+ .booking-completed-monitor)');
    expect(css).toContain('.booking-custom-date-error-row');
    expect(css).toContain('min-height: 56px;');
    expect(css).toContain('min-width: 0;');
  });

  it('uses shared Vuexy badge atoms instead of raw booking monitor pill spans', () => {
    const source = readFileSync('app/bookings/booking-monitor-list-section.tsx', 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="muted">No Partner joined yet</span>');
    expect(source).not.toContain('<span className="pill pill-info">{evidenceLabel}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{senderRole}</span>');
    expect(source).not.toContain('<span className={`pill ${closureState.tone}`}>{closureState.label}</span>');
    expect(source).not.toContain('<span className={`pill ${cancellationReviewSignal.tone}`}>');
    expect(source).not.toContain(
      '<span className={`pill ${reason.tone}`} key={reason.label} title={reason.title}>',
    );
    expect(source).not.toContain('<span className="pill pill-warn">Address missing</span>');
  });

  it('uses shared Vuexy state atoms for post-match chat loading, error, and empty copy', () => {
    const source = readFileSync('app/bookings/booking-monitor-list-section.tsx', 'utf8');

    expect(source).toContain('AdminLoadingState');
    expect(source).toContain('AdminErrorState');
    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain(
      '<div className="booking-chat-empty">Loading retained chat messages...</div>',
    );
    expect(source).not.toContain('<div className="booking-chat-empty">{chatState.error}</div>');
    expect(source).not.toContain(
      '<div className="booking-chat-empty">No retained chat messages for this booking.</div>',
    );
  });

  it('uses the shared DateTimeText atom for retained chat message timestamps', () => {
    const source = readFileSync('app/bookings/booking-monitor-list-section.tsx', 'utf8');

    expect(source).toContain("from '../../components/date-time-text'");
    expect(source).toContain('<DateTimeText fallback="Missing" value={message.createdAt} />');
    expect(source).not.toContain('<time>{formatBookingDate(message.createdAt)}</time>');
  });

  it('uses the shared Vuexy trace summary atom for post-match cancellation review metrics', () => {
    const source = readFileSync('app/bookings/booking-monitor-list-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="vuexy-booking-review-summary"');
    expect(source).not.toContain('<div className={`vuexy-booking-review-metric ${metric.tone}`}');
  });

  it('uses the shared Vuexy button atom for post-match chat close controls', () => {
    const source = readFileSync('app/bookings/booking-monitor-list-section.tsx', 'utf8');

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n            aria-label="Close chat evidence"');
  });

  it('scopes post-match chat dialog header typography to the direct copy slot', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.booking-chat-dialog-header > div > h3');
    expect(css).toContain('.booking-chat-dialog-header > div > p');
    expect(css).not.toContain('.booking-chat-dialog-header h3');
    expect(css).not.toContain('.booking-chat-dialog-header p');
  });

  it('uses the shared table pagination footer for booking status groups', () => {
    const source = readFileSync('app/bookings/booking-monitor-list-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('<AdminTableFooter>');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
    expect(source).not.toContain('Showing {pageFrom} to {pageTo} of {group.rows.length} entries');
  });

  it('uses the shared Vuexy text link atom for booking row drill-down links', () => {
    const source = readFileSync('app/bookings/booking-monitor-list-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders realtime booking rows with the compact operations columns', () => {
    const booking = {
      id: 'booking_123456789',
      customerProfile: {
        user: {
          appSessions: [{ deviceLanguage: 'vi-VN' }],
          fullName: 'Customer A',
          phone: '+84*****0000',
        },
      },
      earning: {
        currency: 'VND',
        id: 'earning_123',
        netAmount: -20000,
      },
      payment: {
        amount: 150000,
        currency: 'VND',
        id: 'payment_123',
        method: 'CARD',
        status: 'PENDING',
      },
      participants: [
        {
          id: 'participant_1',
          providerProfile: {
            displayName: 'Partner C',
            id: 'partner_participant',
            user: {
              fullName: 'Partner C',
              phone: '+84922222222',
            },
          },
          providerProfileId: 'partner_participant',
          status: 'ACCEPTED',
        },
        {
          id: 'participant_2',
          providerProfile: {
            displayName: 'Partner D',
            id: 'partner_d',
          },
          providerProfileId: 'partner_d',
          status: 'JOINED',
        },
        {
          id: 'participant_3',
          providerProfile: {
            displayName: 'Partner E',
            id: 'partner_e',
          },
          providerProfileId: 'partner_e',
          status: 'JOINED',
        },
        {
          id: 'participant_4',
          providerProfile: {
            displayName: 'Partner F',
            id: 'partner_f',
          },
          providerProfileId: 'partner_f',
          status: 'JOINED',
        },
        {
          id: 'participant_5',
          providerProfile: {
            displayName: 'Partner G',
            id: 'partner_g',
          },
          providerProfileId: 'partner_g',
          status: 'JOINED',
        },
      ],
      preferredProvider: {
        displayName: 'Partner A',
        id: 'partner_preferred',
        user: {
          phone: '+84911111111',
        },
      },
      selectedProvider: {
        id: 'partner_selected',
        displayName: 'Partner B',
      },
      customerProfileId: 'customer_123',
      address: {
        formattedAddress: `Đ. Xuân Thủy/241 P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội 10000 ${KOREAN_VIETNAM_COUNTRY}`,
      },
      addressSnapshot: {
        address: {
          label: 'Booking pin 16.0471, 108.2062',
        },
        addressText: null,
      },
      serviceAddressText: 'Cầu Giấy, Hà Nội',
      status: 'OPEN_MATCHING',
      statusChangedAt: '2026-06-12T03:15:00.000Z',
      statusChangedLabel: 'Matching opened at',
    } as unknown as AdminBooking;
    const row: BookingMonitorListRow = {
      actionChips: [
        {
          detail: 'Payment needs review.',
          href: '/bookings?view=payment',
          label: 'Payment check',
          tone: 'pill-warn',
        },
      ],
      addressState: {
        detail: 'Address snapshot ready.',
        label: 'Address ready',
        pin: '10.0, 106.0',
        tone: 'pill-success',
      },
      backupAlert: {
        label: 'No alert delivery gap',
        pill: 'Alerts clear',
        tone: 'pill-success',
      },
      booking,
      cashDebtAmountLabel: '20,000 VND',
      cashDebtNeedsOps: true,
      chatState: {
        detail: 'Chat opens after final Partner choice.',
        label: 'Chat pending',
        tone: 'pill-info',
      },
      checkSignal: {
        helper: '1 check(s)',
        label: 'Monitor',
        tone: 'signal-info',
      },
      closureState: null,
      commandDecisionStrip: {
        primaryAction: 'Review payment',
        primaryDetail: 'Payment is still pending.',
        status: 'Finance',
        tone: 'pill-warn',
      },
      customerVisibleStateLabel: 'Customer sees Partner choices',
      expiresAtLabel: '12 Jun 2026, 10:15',
      finalGateReason: {
        detail: 'Payment has to clear before closeout.',
        href: '/bookings/booking_123456789#finance',
        label: 'Payment gate',
        tone: 'pill-warn',
      },
      finalPartnerLabel: 'Partner B',
      firstCheckTitle: 'Payment unresolved',
      firstPickPhoneLabel: 'First-pick phone +84911111111',
      hasMatchingPolicySnapshot: true,
      location: {
        pillLabel: 'Location recent',
        signalLabel: 'Partner location: 3m ago',
        toneClass: 'pill-success',
      },
      matchingPolicySummaryLabel: 'Policy saved',
      matchingRuleSnapshot: {
        customerChoiceLabel: 'Customer choice enabled',
        operatorAction: 'Monitor customer choice.',
        radiusLabel: '5 km radius',
        sourceLabel: 'Saved policy',
        sourceTone: 'pill-info',
        supplyLabel: '1 partner visible',
        windowLabel: '8m left',
      },
      marketplaceParticipantOverflowCount: 1,
      marketplaceParticipants: [
        {
          id: 'participant_1',
          partnerLabel: 'Partner A',
          status: 'ACCEPTED',
        },
      ],
      nextActionHelper: 'Payment requires review.',
      nextActionLabel: 'Confirm payment state.',
      openedDateLabel: '12 Jun 2026, 10:00',
      opsSignal: <span className="signal signal-warn">Payment pending</span>,
      preferredPartnerLabel: 'Partner A',
      preferredProviderStateLabel: 'pending',
      pricingPolicy: {
        label: 'Pricing ready',
        status: 'ready',
        tone: 'pill-success',
      },
      selectedFinalPartnerPillLabel: 'Partner B',
      selection: {
        label: 'Marketplace Partner selected',
        pathLabel: 'Customer selected a marketplace Partner',
        toneClass: 'pill-success',
      },
      serviceOptionLabel: 'Foot Massage',
      servicePayoutLabel: 'Partner payout 70%',
      servicePriceLabel: '150,000 VND',
      stage: {
        action: 'Monitor Partner choice and handoff.',
        detail: 'Marketplace options are ready.',
        href: '/bookings/booking_123456789#participants',
        key: 'marketplace',
        label: 'Stage 2 marketplace',
        tone: 'info',
      },
      statusEvent: {
        clockLabel: '10:15',
        dateLabel: '12 Jun 2026, 10:15',
        label: 'Matching opened',
        relativeLabel: 'Matching opened 2m ago',
      },
    };

    const section = <BookingMonitorListSection emptyMessage="No bookings match filters." rows={[row]} />;
    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Request Time');
    expect(rendered).toContain('Customer');
    expect(rendered).toContain('Requested');
    expect(rendered).toContain('Participating');
    expect(rendered).toContain('Country');
    expect(rendered).toContain('Service Type');
    expect(rendered).toContain('Address');
    expect(rendered).toContain('State');
    expect(rendered).not.toContain('Actions');
    expect(rendered).not.toContain('Status');
    expect(rendered).toContain('Live / Today Bookings');
    expect(rendered).toContain(
      'Current requests from booking submission through matching wait before final Partner assignment.',
    );
    expect(rendered).toContain('Live In Progress');
    expect(rendered).toContain('Closeout Records');
    expect(rendered).toContain('Other Closed Records');
    expect(rendered).toContain('Cancellation Review / Needs Action');
    expect(rendered).toContain('Cancellation Records / Resolved');
    expect(rendered).toContain('No post-match bookings are in progress.');
    expect(rendered).toContain('No completed bookings in this result set.');
    expect(rendered).toContain('No pending post-match cancellation reviews in this result set.');
    expect(rendered).toContain('No resolved post-match cancellation decisions in this result set.');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('+84*****0000');
    expect(rendered).not.toContain('+84900000000');
    expect(rendered).toContain('Partner A');
    expect(rendered).toContain('Vietnam');
    expect(rendered).not.toContain('vi-VN');
    expect(rendered).toContain('Cầu Giấy, Hà Nội');
    expect(rendered).toContain('Service type');
    expect(rendered).toContain('Service address');
    expect(rendered).not.toContain('Booking pin');
    expect(rendered).toContain('Matching opened');
    expect(rendered).not.toContain('Matching opened at');
    expect(rendered).toContain('State changed');
    expect(rendered).not.toContain('Detail');
    expect(rendered).toContain('+84911111111');
    expect(rendered).not.toContain('First-pick phone');
    expect(rendered).not.toContain('Updated 2m ago');
    expect(rendered).not.toContain('5 participating');
    expect(rendered).toContain('150,000 VND');
    expect(markup).toContain('<div class="muted">12 Jun 2026, 10:00</div>');
    expect(
      markup.split(
        'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section"',
      ).length - 1,
    ).toBe(6);
    expect(markup).not.toContain('vuexy-booking-table-groups');
    expect(markup).toContain('href="/bookings/booking_123456789"');
    expect(markup).toContain('href="/customers/customer_123"');
    expect(markup).toContain('href="/partners/partner_preferred"');
    expect(markup).toContain('href="/partners/partner_participant"');
    expect(markup).toContain('vuexy-booking-country-cell');
    expect(markup).toContain('vuexy-booking-country-flag');
    expect(markup).toContain('aria-label="Country: Vietnam"');
    expect(markup).toContain('aria-label="Vietnam flag"');
    expect(markup).toContain('vuexy-booking-service-cell');
    expect(markup).toContain('aria-label="Service type: Foot Massage"');
    expect(markup).toContain('vuexy-booking-address-cell');
    expect(markup).toContain('title="Cầu Giấy, Hà Nội"');
    expect(markup).toContain('aria-label="Service address: Cầu Giấy, Hà Nội"');
    expect(markup).not.toContain('Đ. Xuân Thủy/241 P. Dịch Vọng Hậu');
    expect(markup).toContain('vuexy-booking-state-cell');
    expect(markup).toContain('aria-label="State changed: Matching opened"');
    expect(markup).toContain('vuexy-booking-avatar-group');
    expect(markup).toContain('aria-label="Partner C (ACCEPTED)"');
    expect(markup).toContain('admin-person-avatar-shell');
    expect(markup).toContain('admin-avatar-status-dot is-matching');
    expect(markup).toContain('aria-label="Matching waiting"');
    expect(markup).toContain('>+1</span>');
    expect(markup).not.toContain('status-badge');
  });

  it('renders the empty booking message', () => {
    const section = <BookingMonitorListSection emptyMessage="No bookings match filters." rows={[]} />;
    const rendered = normalizedText(renderToStaticMarkup(section));

    expect(rendered).toContain('No bookings match filters.');
    expect(rendered).toContain('Live / Today Bookings');
    expect(rendered).toContain('Live In Progress');
    expect(rendered).toContain('Closeout Records');
    expect(rendered).toContain('Cancellation Review / Needs Action');
    expect(rendered).toContain('Cancellation Records / Resolved');
  });

  it('renders a retryable alert instead of the empty state when the booking list fails', () => {
    const markup = renderToStaticMarkup(
      <BookingMonitorListSection
        emptyMessage="No bookings match filters."
        loadFailed
        retryHref="/bookings?view=needs-action"
        rows={[]}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Booking records unavailable');
    expect(markup).toContain('/bookings?view=needs-action');
    expect(markup).not.toContain('No bookings match filters.');
  });

  it('limits visible booking table groups for route-specific workspaces', () => {
    const section = (
      <BookingMonitorListSection
        emptyMessage="No realtime bookings match filters."
        rows={[
          bookingRowFixture({
            customerName: 'Waiting Customer',
            id: 'booking_waiting',
            openedDateLabel: '12 Jun 2026, 10:00',
            status: 'OPEN_MATCHING',
            statusChangedAt: '2026-06-12T03:15:00.000Z',
          }),
          bookingRowFixture({
            customerName: 'Working Customer',
            id: 'booking_working',
            openedDateLabel: '12 Jun 2026, 10:05',
            status: 'IN_SERVICE',
            statusChangedAt: '2026-06-12T03:20:00.000Z',
          }),
          bookingRowFixture({
            customerName: 'Completed Customer',
            id: 'booking_completed',
            openedDateLabel: '12 Jun 2026, 10:10',
            status: 'COMPLETED',
            statusChangedAt: '2026-06-12T03:25:00.000Z',
          }),
          bookingRowFixture({
            closedAt: '2026-06-12T03:30:00.000Z',
            customerName: 'Cancelled Customer',
            id: 'booking_cancelled',
            openedDateLabel: '12 Jun 2026, 10:15',
            status: 'CANCELLED',
            statusChangedAt: '2026-06-12T03:30:00.000Z',
          }),
        ]}
        visibleGroupKeys={['pre-match', 'post-match-in-progress']}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Live / Today Bookings');
    expect(rendered).toContain('Live In Progress');
    expect(rendered).toContain('Waiting Customer');
    expect(rendered).toContain('Working Customer');
    expect(markup).not.toContain('id="booking-table-completed-title"');
    expect(markup).not.toContain('id="booking-table-closed-records-title"');
    expect(markup).not.toContain('id="booking-table-post-match-cancellations-pending-title"');
    expect(markup).not.toContain('id="booking-table-post-match-cancellations-resolved-title"');
    expect(markup).not.toContain('>Closeout Records</h2>');
    expect(markup).not.toContain('>Other Closed Records</h2>');
    expect(markup).not.toContain('>Cancellation Review / Needs Action</h2>');
    expect(markup).not.toContain('>Cancellation Records / Resolved</h2>');
    expect(rendered).not.toContain('Completed Customer');
    expect(rendered).not.toContain('Cancelled Customer');
    expect(
      markup.split(
        'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section"',
      ).length - 1,
    ).toBe(2);
  });

  it('shows terminal records and hides unrelated empty groups in the recent records workspace', () => {
    const section = (
      <BookingMonitorListSection
        emptyMessage="No recent booking records."
        hideEmptyGroups
        rows={[
          bookingRowFixture({
            customerName: 'Expired Customer',
            id: 'booking_expired',
            openedDateLabel: '12 Jun 2026, 10:00',
            status: 'EXPIRED',
            statusChangedAt: '2026-06-12T03:15:00.000Z',
          }),
          bookingRowFixture({
            customerName: 'Refunded Customer',
            id: 'booking_refunded',
            openedDateLabel: '12 Jun 2026, 10:05',
            status: 'REFUNDED',
            statusChangedAt: '2026-06-12T03:20:00.000Z',
          }),
        ]}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Other Closed Records');
    expect(rendered).toContain('Expired Customer');
    expect(rendered).toContain('Refunded Customer');
    expect(rendered).not.toContain('Live / Today Bookings');
    expect(rendered).not.toContain('Live In Progress');
    expect(rendered).not.toContain('Closeout Records');
  });

  it('shows the actual matched Partner in post-match in-progress rows', () => {
    const section = (
      <BookingMonitorListSection
        emptyMessage="No realtime bookings match filters."
        rows={[
          bookingRowFixture({
            customerName: 'Working Customer',
            id: 'booking_working_matched',
            matchedAt: '2026-06-12T03:18:00.000Z',
            openedDateLabel: '12 Jun 2026, 10:05',
            selectedProviderId: 'partner_selected',
            selectedProviderName: 'Partner Matched',
            selectedProviderPhone: '+84922222222',
            status: 'IN_SERVICE',
            statusChangedAt: '2026-06-12T03:20:00.000Z',
          }),
        ]}
        visibleGroupKeys={['post-match-in-progress']}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Matched');
    expect(rendered).toContain('Partner Matched');
    expect(rendered).toContain('+84922222222');
    expect(markup).toContain('href="/partners/partner_selected"');
  });

  it('sorts each status table by latest state change first', () => {
    const section = (
      <BookingMonitorListSection
        emptyMessage="No bookings match filters."
        rows={[
          bookingRowFixture({
            id: 'booking_completed_older',
            customerName: 'Older Customer',
            openedDateLabel: '12 Jun 2026, 10:00',
            status: 'COMPLETED',
            statusChangedAt: '2026-06-12T03:15:00.000Z',
          }),
          bookingRowFixture({
            id: 'booking_completed_newer',
            customerName: 'Newer Customer',
            openedDateLabel: '13 Jun 2026, 10:00',
            status: 'COMPLETED',
            statusChangedAt: '2026-06-13T03:15:00.000Z',
          }),
        ]}
      />
    );

    const markup = renderToStaticMarkup(section);

    expect(markup.indexOf('Newer Customer')).toBeLessThan(markup.indexOf('Older Customer'));
  });

  it('renders closure evidence for post-match cancellation rows', () => {
    const section = (
      <BookingMonitorListSection
        emptyMessage="No bookings match filters."
        rows={[
          bookingRowFixture({
            closedAt: '2026-06-13T03:20:00.000Z',
            closedByRole: 'ADMIN',
            closedReason: 'provider_cancelled',
            closureState: {
              detail: 'admin closure / Provider Cancelled / Partner cancelled from chat.',
              label: 'Closed 13 Jun 2026, 03:20',
              tone: 'pill-info',
            },
            customerName: 'Cancel Customer',
            id: 'booking_cancelled_after_match',
            openedDateLabel: '13 Jun 2026, 03:00',
            status: 'CANCELLED',
            statusChangedAt: '2026-06-13T03:20:00.000Z',
          }),
        ]}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Cancellation Review / Needs Action');
    expect(rendered).toContain('Closed 13 Jun 2026, 03:20');
    expect(rendered).toContain('Admin confirmed');
    expect(rendered).toContain('admin closure / Provider Cancelled / Partner cancelled from chat.');
    expect(rendered).not.toContain('Chat (0)');
    expect(markup).toContain('vuexy-booking-closure-evidence');
    expect(markup).toContain('vuexy-booking-closure-pills');
    expect(markup).toContain('vuexy-booking-state-cell');
    expect(markup).not.toContain('vuexy-booking-actions-cell');
    expect(markup).toContain('aria-label="State changed: Partner cancelled"');
    expect(markup).toContain('pill-success');
    expect(markup).toContain('pill-info');
    expect(markup.indexOf('Cancel Customer')).toBeGreaterThan(
      markup.indexOf('Cancellation Review / Needs Action'),
    );
    expect(markup.indexOf('Cancel Customer')).toBeLessThan(markup.indexOf('Cancellation Records / Resolved'));
  });

  it('hides manual post-match cancellation decision controls from the table', () => {
    const row = bookingRowFixture({
      closedAt: '2026-06-13T03:30:00.000Z',
      closedByRole: 'PROVIDER',
      closedReason: 'partner_cancelled',
      customerName: 'Manual Review Customer',
      id: 'booking_manual_cancelled_after_match',
      matchedAt: '2026-06-13T03:00:00.000Z',
      openedDateLabel: '13 Jun 2026, 03:00',
      status: 'CANCELLED',
      statusChangedAt: '2026-06-13T03:30:00.000Z',
    });
    const section = (
      <BookingMonitorListSection
        emptyMessage="No bookings match filters."
        rows={[
          {
            ...row,
            booking: {
              ...row.booking,
              chatRoom: {
                id: 'chat_manual_cancelled',
                messages: [
                  {
                    id: 'message_1',
                    body: 'I need to cancel after matching.',
                    createdAt: '2026-06-13T03:29:00.000Z',
                    sender: {
                      fullName: 'Partner Manual',
                      roles: ['PROVIDER'],
                    },
                  },
                ],
              },
              earning: {
                id: 'earning_manual_cancelled',
                netAmount: -30000,
                status: 'PENDING',
              },
              metadata: {
                postMatchCancellation: {
                  reasonCode: 'CUSTOMER_NOT_FOUND',
                  reasonLabel: 'Could not meet customer',
                  requiresAdminReview: true,
                },
              },
            } as unknown as AdminBooking,
          },
        ]}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Manual Review Customer');
    expect(rendered).toContain('Cancellation Review / Needs Action');
    expect(rendered).toContain('Manual review');
    expect(rendered).toContain('Partner cancellation after 15m; confirm chat before closing.');
    expect(rendered).toContain('Missing chat');
    expect(rendered).toContain('Fee deduction remains until approval.');
    expect(rendered).not.toContain('Chat (1)');
    expect(rendered).toContain('Fee held');
    expect(rendered).toContain('After 15m');
    expect(rendered).toContain('Could not meet customer');
    expect(rendered).not.toContain('Resolve cancellation');
    expect(markup).not.toContain('admin-action-dropdown booking-post-match-action-dropdown');
    expect(markup).not.toContain('admin-action-menu booking-post-match-action-menu');
    expect(markup).not.toContain('admin-action-form');
    expect(markup).toContain('aria-label="Post-match cancellation review priorities"');
    expect(markup).toContain('aria-label="Cancellation review reasons"');
    expect(markup).toContain(
      'title="Partner cancellation happened after the 15-minute auto-approval window."',
    );
    expect(markup).toContain(
      'title="The Partner could not meet the customer. Admin evidence review is required."',
    );
    expect(markup).toContain('title="Partner fee deduction remains until approval."');
    expect(markup).toContain('service-trace-summary vuexy-booking-review-summary');
    expect(markup).toContain('vuexy-booking-review-reasons');
    expect(markup).toContain('class="is-warn"');
    expect(markup).toContain('class="is-danger"');
    expect(markup).not.toContain(
      'type="hidden" name="bookingId" value="booking_manual_cancelled_after_match"',
    );
    expect(markup).not.toContain(
      'type="hidden" name="note" value="Approved after admin chat evidence review."',
    );
    expect(markup).not.toContain('type="hidden" name="note" value="Held after admin chat evidence review."');
    expect(markup.indexOf('Manual Review Customer')).toBeGreaterThan(
      markup.indexOf('Cancellation Review / Needs Action'),
    );
    expect(markup.indexOf('Manual Review Customer')).toBeLessThan(
      markup.indexOf('Cancellation Records / Resolved'),
    );
  });

  it('renders a Vuexy-style evidence snapshot inside the post-match chat layer', () => {
    const row = bookingRowFixture({
      closedAt: '2026-06-13T03:30:00.000Z',
      closedByRole: 'PROVIDER',
      closedReason: 'partner_cancelled',
      customerName: 'Manual Review Customer',
      id: 'booking_manual_cancelled_after_match',
      matchedAt: '2026-06-13T03:00:00.000Z',
      openedDateLabel: '13 Jun 2026, 03:00',
      status: 'CANCELLED',
      statusChangedAt: '2026-06-13T03:30:00.000Z',
    });

    const markup = renderToStaticMarkup(
      <BookingPostMatchCancellationChatLayer
        onClose={() => undefined}
        row={{
          ...row,
          booking: {
            ...row.booking,
            chatRoom: {
              id: 'chat_manual_cancelled',
              messages: [
                {
                  id: 'message_1',
                  body: 'I need to cancel after matching.',
                  createdAt: '2026-06-13T03:29:00.000Z',
                  sender: {
                    fullName: 'Partner Manual',
                    roles: ['PROVIDER'],
                  },
                },
              ],
            },
            closedNote: 'Partner cancelled from chat.',
            earning: {
              id: 'earning_manual_cancelled',
              netAmount: -30000,
              status: 'PENDING',
            },
          } as unknown as AdminBooking,
        }}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Cancellation evidence record');
    expect(rendered).not.toContain('Cancellation evidence snapshot');
    expect(rendered).toContain('Review state');
    expect(rendered).toContain('Pending admin decision');
    expect(rendered).toContain('30m after match / Fee held');
    expect(rendered).toContain('Closure source');
    expect(rendered).toContain('Partner');
    expect(rendered).toContain('Partner Cancelled');
    expect(rendered).toContain('Retained chat');
    expect(rendered).toContain('1 message');
    expect(rendered).toContain('Closure note');
    expect(rendered).toContain('Partner cancelled from chat.');
    expect(markup).toContain('booking-chat-evidence-grid');
    expect(markup).toContain('booking-chat-evidence-item');
  });

  it('distinguishes auto-approved post-match cancellations from manual approvals', () => {
    const section = (
      <BookingMonitorListSection
        emptyMessage="No bookings match filters."
        rows={[
          bookingRowFixture({
            closedAt: '2026-06-13T03:10:00.000Z',
            closedByRole: 'PROVIDER',
            closedReason: 'post_match_cancellation_approved',
            customerName: 'Auto Customer',
            id: 'booking_auto_cancelled_after_match',
            matchedAt: '2026-06-13T03:00:00.000Z',
            openedDateLabel: '13 Jun 2026, 03:00',
            status: 'CANCELLED',
            statusChangedAt: '2026-06-13T03:10:00.000Z',
          }),
        ]}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Cancellation Records / Resolved');
    expect(rendered).not.toContain('Admin review required');
    expect(markup).not.toContain('vuexy-booking-actions-cell');
    expect(markup).not.toContain('admin-action-dropdown booking-post-match-action-dropdown');
    expect(markup.indexOf('Auto Customer')).toBeGreaterThan(
      markup.indexOf('Cancellation Records / Resolved'),
    );
  });

  it('keeps no-show review rows in the post-match cancellations group without fee decision actions', () => {
    const section = (
      <BookingMonitorListSection
        emptyMessage="No bookings match filters."
        rows={[
          bookingRowFixture({
            closedAt: '2026-06-13T03:30:00.000Z',
            closedByRole: 'ADMIN',
            closedReason: 'no_show_confirmed',
            customerName: 'No Show Customer',
            id: 'booking_no_show_after_match',
            matchedAt: '2026-06-13T03:00:00.000Z',
            openedDateLabel: '13 Jun 2026, 03:00',
            status: 'NO_SHOW',
            statusChangedAt: '2026-06-13T03:30:00.000Z',
          }),
        ]}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Cancellation Review / Needs Action');
    expect(rendered).toContain('No Show Customer');
    expect(rendered).toContain('No-show marked');
    expect(rendered).not.toContain('No-show marked at');
    expect(rendered).toContain('No-show');
    expect(rendered).toContain('Check Partner message and retained evidence.');
    expect(rendered).toContain('Missing chat');
    expect(rendered).toContain('Open detail if no retained chat is attached.');
    expect(rendered).not.toContain('Chat (0)');
    expect(rendered).toContain('No chat');
    expect(rendered).toContain('No-show review');
    expect(rendered).not.toContain('Detail');
    expect(rendered).not.toContain('Resolve cancellation');
    expect(markup).not.toContain('admin-action-dropdown booking-post-match-action-dropdown');
    expect(markup).toContain('aria-label="Cancellation review reasons"');
    expect(markup).toContain('title="No-show review needs retained evidence."');
    expect(markup).toContain('title="No retained chat messages are attached."');
    expect(markup).not.toContain(
      'type="hidden" name="note" value="Approved after admin chat evidence review."',
    );
    expect(markup).not.toContain('type="hidden" name="note" value="Held after admin chat evidence review."');
    expect(markup).toContain('href="/bookings/booking_no_show_after_match"');
  });
});

function bookingRowFixture(input: {
  readonly closedAt?: string;
  readonly closedByRole?: string;
  readonly closedReason?: string;
  readonly closureState?: BookingMonitorListRow['closureState'];
  readonly customerName: string;
  readonly id: string;
  readonly matchedAt?: string;
  readonly openedDateLabel: string;
  readonly selectedProviderId?: string;
  readonly selectedProviderName?: string;
  readonly selectedProviderPhone?: string;
  readonly status: string;
  readonly statusChangedAt: string;
}): BookingMonitorListRow {
  const selectedProviderId =
    input.selectedProviderId ??
    (input.status === 'CANCELLED' || input.status === 'NO_SHOW' ? `${input.id}_partner` : null);
  const selectedProvider =
    selectedProviderId && input.selectedProviderName
      ? {
          displayName: input.selectedProviderName,
          id: selectedProviderId,
          user: {
            phone: input.selectedProviderPhone,
          },
        }
      : null;
  const booking = {
    address: {
      formattedAddress: '24 Le Loi, Da Nang',
    },
    customerProfile: {
      id: `${input.id}_customer`,
      user: {
        appSessions: [{ deviceLanguage: 'vi-VN' }],
        fullName: input.customerName,
        phone: '+84900000000',
      },
    },
    closedAt: input.closedAt ?? null,
    closedByRole: input.closedByRole ?? null,
    closedReason: input.closedReason ?? null,
    earning:
      input.closedReason === 'post_match_cancellation_approved'
        ? { id: `${input.id}_earning`, netAmount: 0, status: 'CANCELLED' }
        : null,
    id: input.id,
    matchedAt: input.matchedAt ?? null,
    selectedProvider,
    selectedProviderId,
    status: input.status,
    statusChangedAt: input.statusChangedAt,
    statusChangedLabel:
      input.status === 'CANCELLED'
        ? 'Partner cancelled at'
        : input.status === 'NO_SHOW'
          ? 'No-show marked at'
          : 'Completed at',
  } as unknown as AdminBooking;

  return {
    actionChips: [],
    addressState: {
      detail: 'Address snapshot ready.',
      label: 'Address ready',
      pin: '16.0471, 108.2062',
      tone: 'pill-success',
    },
    backupAlert: {
      label: 'No alert delivery gap',
      pill: 'Alerts clear',
      tone: 'pill-success',
    },
    booking,
    cashDebtAmountLabel: null,
    cashDebtNeedsOps: false,
    chatState: {
      detail: 'Chat retained.',
      label: 'Chat ready',
      tone: 'pill-success',
    },
    checkSignal: {
      helper: 'No check',
      label: 'Checks clear',
      tone: 'signal-ok',
    },
    closureState: input.closureState ?? null,
    commandDecisionStrip: {
      primaryAction: 'Review closeout',
      primaryDetail: 'Check retained booking evidence.',
      status: 'Closeout',
      tone: 'pill-info',
    },
    customerVisibleStateLabel: 'Customer sees completed booking',
    expiresAtLabel: null,
    finalGateReason: {
      detail: 'No gate.',
      href: `/bookings/${input.id}`,
      label: 'Clear',
      tone: 'pill-success',
    },
    finalPartnerLabel: null,
    firstCheckTitle: null,
    firstPickPhoneLabel: 'No requested Partner',
    hasMatchingPolicySnapshot: false,
    location: {
      pillLabel: 'Location retained',
      signalLabel: 'Location retained',
      toneClass: 'pill-success',
    },
    matchingPolicySummaryLabel: 'Policy saved',
    matchingRuleSnapshot: {
      customerChoiceLabel: 'Customer choice enabled',
      operatorAction: 'Review closeout.',
      radiusLabel: '5 km radius',
      sourceLabel: 'Saved policy',
      sourceTone: 'pill-info',
      supplyLabel: '0 partner visible',
      windowLabel: 'Closed',
    },
    marketplaceParticipantOverflowCount: 0,
    marketplaceParticipants: [],
    nextActionHelper: 'Check retained booking evidence.',
    nextActionLabel: 'Review closeout.',
    openedDateLabel: input.openedDateLabel,
    opsSignal: null,
    preferredPartnerLabel: 'none',
    preferredProviderStateLabel: null,
    pricingPolicy: {
      label: 'Pricing ready',
      status: 'ready',
      tone: 'pill-success',
    },
    selectedFinalPartnerPillLabel: null,
    selection: {
      label: 'Closed',
      pathLabel: 'Closed booking',
      toneClass: 'pill-success',
    },
    serviceOptionLabel: 'Foot Massage',
    servicePayoutLabel: null,
    servicePriceLabel: '150,000 VND',
    stage: {
      action: 'Review closeout.',
      detail: 'Completed booking.',
      href: `/bookings/${input.id}`,
      key: 'handoff',
      label: 'Completed',
      tone: 'ok',
    },
    statusEvent: {
      clockLabel: '10:15',
      dateLabel: input.statusChangedAt,
      label:
        input.status === 'OPEN_MATCHING'
          ? 'Matching opened'
          : input.status === 'NO_SHOW'
            ? 'No-show marked'
            : input.status === 'CANCELLED'
              ? 'Partner cancelled'
              : 'Completed',
      relativeLabel: input.status === 'OPEN_MATCHING' ? 'Matching opened 12m ago' : 'Updated just now',
    },
  };
}
