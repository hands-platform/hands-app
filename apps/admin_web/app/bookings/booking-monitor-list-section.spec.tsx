import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBooking } from '../../lib/admin-api';
import {
  BookingMonitorListSection,
  type BookingMonitorListRow,
} from './booking-monitor-list-section';

describe('BookingMonitorListSection', () => {
  it('renders booking rows with stage, partner, payment, and ops links', () => {
    const booking = {
      id: 'booking_123456789',
      customerProfile: {
        user: {
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
      participants: [{ id: 'participant_1' }],
      preferredProvider: {
        user: {
          phone: '+84911111111',
        },
      },
      selectedProvider: {
        displayName: 'Partner B',
      },
      status: 'OPEN_MATCHING',
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
        detail: 'Chat opens after final partner choice.',
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
      customerVisibleStateLabel: 'Customer sees partner choices',
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
        label: 'Marketplace partner selected',
        pathLabel: 'Customer selected a marketplace partner',
        toneClass: 'pill-success',
      },
      serviceOptionLabel: 'Foot Massage',
      servicePayoutLabel: 'Partner payout 70%',
      servicePriceLabel: '150,000 VND',
      stage: {
        action: 'Monitor partner choice and handoff.',
        detail: 'Marketplace options are ready.',
        href: '/bookings/booking_123456789#participants',
        key: 'marketplace',
        label: 'Stage 2 marketplace',
        tone: 'info',
      },
    };

    const section = BookingMonitorListSection({
      emptyMessage: 'No bookings match filters.',
      rows: [row],
    });
    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Booking / stage');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('Stage 2 marketplace');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('Partner B');
    expect(rendered).toContain('Payment gate');
    expect(rendered).toContain('Cash fee debt 20,000 VND');
    expect(markup).toContain('href="/bookings/booking_123456789"');
    expect(markup).toContain('href="/payments#payment-payment_123"');
    expect(markup).toContain('href="/earnings#earning-earning_123"');
    expect(markup).toContain('href="/bookings?view=payment"');
  });

  it('renders the empty booking message', () => {
    const section = BookingMonitorListSection({
      emptyMessage: 'No bookings match filters.',
      rows: [],
    });

    expect(normalizedText(renderToStaticMarkup(section))).toContain('No bookings match filters.');
  });
});

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
