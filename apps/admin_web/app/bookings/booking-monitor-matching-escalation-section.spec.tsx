import { readFileSync } from 'node:fs';
import type { AdminBooking } from '../../lib/admin-api';
import { classNamesIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';

describe('BookingMonitorMatchingEscalationSection', () => {
  it('uses shared Vuexy badge atoms for policy defaults, metrics, and evidence tags', () => {
    const source = readFileSync('app/bookings/booking-monitor-matching-escalation-section.tsx', 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminSignal');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<span className="muted">No sample bookings</span>');
    expect(source).not.toContain('<span className={`signal ${commandToneClass(lane.tone)}`}>');
    expect(source).not.toContain('<span className={`signal ${commandToneClass(step.tone)}`}>');
    expect(source).not.toContain('<span className={`signal ${commandToneClass(item.tone)}`}>');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-14">');
    expect(source).not.toContain('<span className="pill pill-info">Live policy default</span>');
    expect(source).not.toContain('<span className="pill" key={`${lane.title}-${metricItem.label}`}>');
    expect(source).not.toContain('<span className="pill" key={`${step.stage}-${metricItem.label}`}>');
    expect(source).not.toContain('<span className="pill" key={`${item.booking.id}-${tag}`}>');
  });

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

    expect(section).not.toBeNull();
    if (section === null) throw new Error('Expected matching escalation section to render.');
    const rendered = normalizedText(section);

    expect(rendered).toContain('Matching escalation board');
    expect(rendered).toContain('First-pick window');
    expect(rendered).toContain('First-pick response window');
    expect(rendered).toContain('Matching flow timeline');
    expect(rendered).toContain('Direct-ready Partners');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('8m left');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mt-16',
        'ops-section-header admin-section-header',
      ]),
    );
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-policy',
        '/bookings?view=matching',
        '/partners?review=direct-ready',
        '/bookings/booking_123456789',
      ]),
    );
  });

  it('returns no section when no matching escalation action is waiting', () => {
    const section = BookingMonitorMatchingEscalationSection({
      dispatchPartnerShortcuts: [],
      getCustomerLabel: () => 'Customer A',
      getMatchingWindowLabel: () => 'clear',
      livePolicyCards: [],
      matchingEscalationBoard: [
        {
          bookings: [],
          detail: 'No preferred Partner is currently blocking a direct request.',
          href: '/bookings?view=matching',
          metrics: [{ label: 'waiting', value: '0' }],
          operatorAction: 'Monitor queue.',
          status: 'Clear',
          title: 'First-pick response window',
          tone: 'ok',
        },
      ],
      matchingEscalationRows: [],
      matchingFlowTimeline: [
        {
          bookings: [],
          detail: 'No direct first-pick request is currently waiting.',
          href: '/bookings?view=matching',
          metrics: [{ label: 'waiting', value: '0' }],
          operatorAction: 'Monitor response window.',
          stage: 'Stage 1',
          status: 'Clear',
          title: 'Direct first-pick request',
          tone: 'ok',
        },
      ],
    });

    expect(section).toBeNull();
  });
});
