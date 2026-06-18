import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBooking } from '../../lib/admin-api';
import { normalizedText } from './booking-section-test-utils';
import { BookingMonitorListSection, type BookingMonitorListRow } from './booking-monitor-list-section';

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
    expect(rendered).toContain('Requested Partner');
    expect(rendered).toContain('Participating Partners');
    expect(rendered).toContain('Device Language');
    expect(rendered).toContain('Service Type');
    expect(rendered).toContain('Address');
    expect(rendered).toContain('State Changed');
    expect(rendered).not.toContain('Status');
    expect(rendered).toContain('Pre-match');
    expect(rendered).not.toContain('Post-match / In Progress');
    expect(rendered).not.toContain('Post-match Cancellations');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('Partner A');
    expect(rendered).toContain('Partner B');
    expect(rendered).toContain('vi-VN');
    expect(rendered).toContain('12 Nguyen Hue, Da Nang');
    expect(rendered).not.toContain('Booking pin');
    expect(rendered).toContain('Matching opened at');
    expect(rendered).toContain('5 participating');
    expect(rendered).not.toContain('150,000 VND');
    expect(markup).toContain('href="/bookings/booking_123456789"');
    expect(markup).toContain('href="/customers/customer_123"');
    expect(markup).toContain('href="/partners/partner_preferred"');
    expect(markup).toContain('href="/partners/partner_participant"');
    expect(markup).toContain('vuexy-booking-avatar-group');
    expect(markup).toContain('aria-label="Partner C (ACCEPTED)"');
    expect(markup).toContain('>+1</span>');
    expect(markup).not.toContain('status-badge');
  });

  it('renders the empty booking message', () => {
    const section = <BookingMonitorListSection emptyMessage="No bookings match filters." rows={[]} />;
    const rendered = normalizedText(renderToStaticMarkup(section));

    expect(rendered).toContain('No realtime bookings');
    expect(rendered).toContain('No bookings match filters.');
    expect(rendered).not.toContain('Pre-match');
    expect(rendered).not.toContain('Post-match / In Progress');
    expect(rendered).not.toContain('Post-match Cancellations');
  });
});
