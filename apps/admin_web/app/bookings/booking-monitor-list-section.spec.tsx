import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBooking } from '../../lib/admin-api';
import { normalizedText } from './booking-section-test-utils';
import {
  BookingMonitorListSection,
  BookingPostMatchCancellationChatLayer,
  type BookingMonitorListRow,
} from './booking-monitor-list-section';

describe('BookingMonitorListSection', () => {
  it('renders realtime booking rows with the compact operations columns', () => {
    const booking = {
      id: 'booking_123456789',
      customerProfile: {
        user: {
          appSessions: [{ deviceLanguage: 'vi-VN' }],
          fullName: 'Customer A',
          phone: '+84900000000',
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
        formattedAddress: '12 Nguyen Hue, Da Nang',
      },
      addressSnapshot: {
        address: {
          label: 'Booking pin 16.0471, 108.2062',
        },
        addressText: null,
      },
      serviceAddressText: null,
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
      recencyLabel: 'Updated 2m ago',
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
    expect(rendered).toContain('Realtime Bookings');
    expect(rendered).toContain(
      'Live requests from booking submission through matching wait before final Partner assignment.',
    );
    expect(rendered).toContain('Post-match / In Progress');
    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Post-match Cancellations / Needs Review');
    expect(rendered).toContain('Post-match Cancellations / Resolved');
    expect(rendered).toContain('No post-match bookings are in progress.');
    expect(rendered).toContain('No completed bookings in this result set.');
    expect(rendered).toContain('No pending post-match cancellation reviews in this result set.');
    expect(rendered).toContain('No resolved post-match cancellation decisions in this result set.');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('Partner A');
    expect(rendered).toContain('vi-VN');
    expect(rendered).toContain('Device language');
    expect(rendered).toContain('12 Nguyen Hue, Da Nang');
    expect(rendered).toContain('Service type');
    expect(rendered).toContain('Service address');
    expect(rendered).not.toContain('Booking pin');
    expect(rendered).toContain('Matching opened at');
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
        'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"',
      ).length - 1,
    ).toBe(5);
    expect(markup).not.toContain('vuexy-booking-table-groups');
    expect(markup).toContain('href="/bookings/booking_123456789"');
    expect(markup).toContain('href="/customers/customer_123"');
    expect(markup).toContain('href="/partners/partner_preferred"');
    expect(markup).toContain('href="/partners/partner_participant"');
    expect(markup).toContain('vuexy-booking-language-cell');
    expect(markup).toContain('aria-label="Device language: vi-VN"');
    expect(markup).toContain('vuexy-booking-service-cell');
    expect(markup).toContain('aria-label="Service type: Foot Massage"');
    expect(markup).toContain('vuexy-booking-address-cell');
    expect(markup).toContain('title="12 Nguyen Hue, Da Nang"');
    expect(markup).toContain('aria-label="Service address: 12 Nguyen Hue, Da Nang"');
    expect(markup).toContain('vuexy-booking-state-cell');
    expect(markup).toContain('aria-label="State changed: Matching opened at"');
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
    expect(rendered).toContain('Realtime Bookings');
    expect(rendered).toContain('Post-match / In Progress');
    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Post-match Cancellations / Needs Review');
    expect(rendered).toContain('Post-match Cancellations / Resolved');
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

    expect(rendered).toContain('Realtime Bookings');
    expect(rendered).toContain('Post-match / In Progress');
    expect(rendered).toContain('Waiting Customer');
    expect(rendered).toContain('Working Customer');
    expect(markup).not.toContain('id="booking-table-completed-title"');
    expect(markup).not.toContain('id="booking-table-post-match-cancellations-pending-title"');
    expect(markup).not.toContain('id="booking-table-post-match-cancellations-resolved-title"');
    expect(markup).not.toContain('>Completed</h2>');
    expect(markup).not.toContain('>Post-match Cancellations / Needs Review</h2>');
    expect(markup).not.toContain('>Post-match Cancellations / Resolved</h2>');
    expect(rendered).not.toContain('Completed Customer');
    expect(rendered).not.toContain('Cancelled Customer');
    expect(
      markup.split(
        'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"',
      ).length - 1,
    ).toBe(2);
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

    expect(rendered).toContain('Post-match Cancellations / Needs Review');
    expect(rendered).toContain('Closed 13 Jun 2026, 03:20');
    expect(rendered).toContain('Admin confirmed');
    expect(rendered).toContain('admin closure / Provider Cancelled / Partner cancelled from chat.');
    expect(rendered).not.toContain('Chat (0)');
    expect(markup).toContain('vuexy-booking-closure-evidence');
    expect(markup).toContain('vuexy-booking-closure-pills');
    expect(markup).toContain('vuexy-booking-state-cell');
    expect(markup).not.toContain('vuexy-booking-actions-cell');
    expect(markup).toContain('aria-label="State changed: Partner cancelled at"');
    expect(markup).toContain('pill-success');
    expect(markup).toContain('pill-info');
    expect(markup.indexOf('Cancel Customer')).toBeGreaterThan(
      markup.indexOf('Post-match Cancellations / Needs Review'),
    );
    expect(markup.indexOf('Cancel Customer')).toBeLessThan(
      markup.indexOf('Post-match Cancellations / Resolved'),
    );
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
            } as unknown as AdminBooking,
          },
        ]}
      />
    );

    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Manual Review Customer');
    expect(rendered).toContain('Post-match Cancellations / Needs Review');
    expect(rendered).toContain('Manual review');
    expect(rendered).toContain('Partner cancellation after 15m; confirm chat before closing.');
    expect(rendered).toContain('Missing chat');
    expect(rendered).toContain('Fee deduction remains until approval.');
    expect(rendered).not.toContain('Chat (1)');
    expect(rendered).toContain('Fee held');
    expect(rendered).toContain('After 15m');
    expect(rendered).not.toContain('Resolve cancellation');
    expect(markup).not.toContain('admin-action-dropdown booking-post-match-action-dropdown');
    expect(markup).not.toContain('admin-action-menu booking-post-match-action-menu');
    expect(markup).not.toContain('admin-action-form');
    expect(markup).toContain('aria-label="Post-match cancellation review priorities"');
    expect(markup).toContain('aria-label="Cancellation review reasons"');
    expect(markup).toContain(
      'title="Partner cancellation happened after the 15-minute auto-approval window."',
    );
    expect(markup).toContain('title="Partner fee deduction remains until approval."');
    expect(markup).toContain('vuexy-booking-review-summary');
    expect(markup).toContain('vuexy-booking-review-reasons');
    expect(markup).toContain('vuexy-booking-review-metric is-warn');
    expect(markup).toContain('vuexy-booking-review-metric is-danger');
    expect(markup).not.toContain('type="hidden" name="bookingId" value="booking_manual_cancelled_after_match"');
    expect(markup).not.toContain('type="hidden" name="note" value="Approved after admin chat evidence review."');
    expect(markup).not.toContain('type="hidden" name="note" value="Held after admin chat evidence review."');
    expect(markup.indexOf('Manual Review Customer')).toBeGreaterThan(
      markup.indexOf('Post-match Cancellations / Needs Review'),
    );
    expect(markup.indexOf('Manual Review Customer')).toBeLessThan(
      markup.indexOf('Post-match Cancellations / Resolved'),
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

    expect(rendered).toContain('Cancellation evidence snapshot');
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

    expect(rendered).toContain('Post-match Cancellations / Resolved');
    expect(rendered).not.toContain('Admin review required');
    expect(markup).not.toContain('vuexy-booking-actions-cell');
    expect(markup).not.toContain('admin-action-dropdown booking-post-match-action-dropdown');
    expect(markup.indexOf('Auto Customer')).toBeGreaterThan(
      markup.indexOf('Post-match Cancellations / Resolved'),
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

    expect(rendered).toContain('Post-match Cancellations / Needs Review');
    expect(rendered).toContain('No Show Customer');
    expect(rendered).toContain('No-show marked at');
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
  readonly status: string;
  readonly statusChangedAt: string;
}): BookingMonitorListRow {
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
    selectedProviderId:
      input.status === 'CANCELLED' || input.status === 'NO_SHOW' ? `${input.id}_partner` : null,
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
      label: 'Clear',
      tone: 'signal-success',
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
    recencyLabel: 'Closed',
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
  };
}
