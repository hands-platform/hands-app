import type { AdminBooking } from '../../lib/admin-api';
import { hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';

describe('BookingMonitorMatchingEscalationSection', () => {
  it('renders policy, escalation lanes, timeline, shortcuts, and sample rows', () => {
    const booking = {
      id: 'booking_123456789',
      payment: { currency: 'VND' },
      services: [
        {
          price: 100000,
          service: {
            basePrice: 100000,
            durationMin: 60,
            name: 'Deep Tissue',
            payoutRules: [],
          },
        },
      ],
    } as unknown as AdminBooking;

    const section = BookingMonitorMatchingEscalationSection({
      dispatchPartnerShortcuts: [
        {
          detail: 'Use when preferred Partners must answer inside the response window.',
          href: '/partners?review=direct-ready',
          title: 'Direct-ready Partners',
          tone: 'warn',
          value: '1',
        },
      ],
      getCustomerLabel: () => 'Customer A',
      getMatchingWindowLabel: () => '8m left',
      livePolicyCards: [
        {
          helper: 'Partner response timer.',
          label: 'First-pick window',
          value: '10m',
        },
      ],
      matchingEscalationBoard: [
        {
          bookings: [booking],
          detail: 'Preferred Partners have the first chance.',
          href: '/bookings?view=matching',
          metrics: [{ label: 'waiting', value: '1' }],
          operatorAction: 'Watch response window.',
          status: 'Waiting',
          title: 'First-pick response window',
          tone: 'warn',
        },
      ],
      matchingEscalationRows: [
        {
          booking,
          detail: 'Customer final choice needs attention.',
          operatorAction: 'Prompt support.',
          tags: ['matching'],
          title: 'Customer final selection',
          tone: 'warn',
        },
      ],
      matchingFlowTimeline: [
        {
          bookings: [booking],
          detail: 'Customer selected a preferred Partner.',
          href: '/bookings?view=matching',
          metrics: [{ label: 'waiting', value: '1' }],
          operatorAction: 'Monitor response window.',
          stage: 'Stage 1',
          status: 'Waiting',
          title: 'Direct first-pick request',
          tone: 'warn',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Matching escalation board');
    expect(rendered).toContain('First-pick window');
    expect(rendered).toContain('First-pick response window');
    expect(rendered).toContain('Matching flow timeline');
    expect(rendered).toContain('Direct-ready Partners');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('8m left');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-policy',
        '/bookings?view=matching',
        '/partners?review=direct-ready',
        '/bookings/booking_123456789',
      ]),
    );
  });

  it('renders an empty escalation card when there are no sample rows', () => {
    const section = BookingMonitorMatchingEscalationSection({
      dispatchPartnerShortcuts: [],
      getCustomerLabel: () => 'Customer A',
      getMatchingWindowLabel: () => 'clear',
      livePolicyCards: [],
      matchingEscalationBoard: [],
      matchingEscalationRows: [],
      matchingFlowTimeline: [],
    });

    expect(normalizedText(section)).toContain('No matching escalation right now');
  });
});
