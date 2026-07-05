import { readFileSync } from 'fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import {
  BookingDetailToolbar,
  BookingCommandDecisionStripSection,
  BookingMatchingRuleSnapshotSection,
  BookingMetricGridSection,
  BookingMvpAuthorityContractSection,
  BookingOperatorFirstReadSection,
  BookingOperationsQuickRailSection,
  BookingPriorityBriefingSection,
  BookingRecentOperationsTimelineSection,
} from './booking-command-briefing-sections';

describe('BookingMvpAuthorityContractSection', () => {
  it('renders authority contract rows with shared table styling and links', () => {
    const section = BookingMvpAuthorityContractSection({
      rows: [
        {
          contract: 'Vietnam-only service boundary',
          evidence: 'Booking address is inside supported service area.',
          href: '/operations-policy#service-boundary',
          operatorUse: 'Use this before approving booking creation disputes.',
          scope: 'Booking creation',
          status: 'Clear',
          tone: 'pill-success',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('MVP authority contract');
    expect(rendered).toContain('Vietnam-only service boundary');
    expect(rendered).toContain('Booking address is inside supported service area.');
    expect(rendered).toContain('Use this before approving booking creation disputes.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/operations-policy', '/operations-policy#service-boundary']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table',
        'admin-form-control-link button button-secondary admin-inline-action',
        'pill pill-success',
      ]),
    );
  });
});

describe('BookingCommandBriefingSections', () => {
  it('uses shared Vuexy badge atoms instead of raw command briefing pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-command-briefing-sections.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('actions={<span className={`pill ${commandDecisionStrip.tone}`}>{commandDecisionStrip.status}</span>}');
    expect(source).not.toContain('actions={<span className="pill pill-info">Above-fold summary</span>}');
    expect(source).not.toContain('actions={<span className="pill pill-info">{rows.length} shortcuts</span>}');
    expect(source).not.toContain('actions={<span className={`pill ${matchingRuleSnapshot.tone}`}>{matchingRuleSnapshot.status}</span>}');
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.status}</span>');
    expect(source).not.toContain('actions={<span className={`pill ${operatorPriorityBriefing.tone}`}>{operatorPriorityBriefing.status}</span>}');
  });

  it('uses the shared DateTimeText atom for recent operation timestamps', () => {
    const source = readFileSync('app/bookings/[id]/booking-command-briefing-sections.tsx', 'utf8');

    expect(source).toContain("import { DateTimeText } from '../../../components/date-time-text';");
    expect(source).toContain('<DateTimeText fallback={item.status} value={item.at} />');
    expect(source).not.toContain('<small>{item.at ? formatDate(item.at) : item.status}</small>');
  });

  it('uses the shared metric grid for booking detail command metrics', () => {
    const section = BookingMetricGridSection({
      metrics: [
        {
          helper: 'Customer payment is captured.',
          label: 'Payment',
          value: 'Captured',
        },
      ],
    });
    const markup = renderToStaticMarkup(section);
    const source = readFileSync('app/bookings/[id]/booking-command-briefing-sections.tsx', 'utf8');

    expect(markup).toContain('admin-metric-grid admin-mb-16');
    expect(markup).toContain('Payment');
    expect(source).toContain('AdminMetricGrid');
    expect(source).not.toContain('<section className="grid admin-mb-16">');
  });

  it('renders booking detail toolbar actions without owning the page shell', () => {
    const toolbar = BookingDetailToolbar({
      bookingId: 'booking-detail-1',
      serviceLabel: 'Massage',
      status: 'COMPLETED',
      customerProfileId: 'customer-1',
      finalPartnerId: 'partner-1',
      chatRoomId: 'room-1',
      paymentId: 'payment-1',
      refundId: 'refund-1',
    });
    const markup = renderToStaticMarkup(toolbar);
    const source = readFileSync('app/bookings/[id]/booking-command-briefing-sections.tsx', 'utf8');

    expect(markup).toContain('Back to booking monitor');
    expect(markup).toContain('Open customer');
    expect(markup).not.toContain('toolbar admin-page-header');
    expect(source).not.toContain('AdminPageTemplate');
  });

  it('renders booking command briefing cards with the shared Vuexy admin section surface', () => {
    const linkRows = [
      {
        detail: 'Address snapshot is retained.',
        href: '#address',
        label: 'Address',
        value: 'Ready',
      },
    ];
    const metricRows = [
      {
        helper: 'No blocking policy issue.',
        label: 'Policy',
        value: 'Clear',
      },
    ];
    const sections = [
      BookingCommandDecisionStripSection({
        commandDecisionStrip: {
          primaryAction: 'Continue normal monitoring',
          primaryDetail: 'No immediate booking command issue is active.',
          rows: [
            {
              detail: 'Stored service address is ready.',
              href: '#address-radius-contract',
              lane: 'Address',
              state: 'Snapshot ready',
              tone: 'pill-success',
            },
          ],
          status: 'Monitoring',
          tone: 'pill-success',
        },
      }),
      BookingOperatorFirstReadSection({ rows: linkRows }),
      BookingOperationsQuickRailSection({ rows: linkRows }),
      BookingMatchingRuleSnapshotSection({
        matchingRuleSnapshot: {
          actions: [{ href: '/operations-policy#matching', label: 'Open matching policy' }],
          rows: metricRows,
          status: 'Policy ready',
          summary: 'Matching rule follows the current operations policy.',
          tone: 'pill-info',
        },
      }),
      BookingRecentOperationsTimelineSection({
        operatingTimeline: [
          {
            detail: 'Operator checked address evidence.',
            id: 'timeline-1',
            status: 'Complete',
            title: 'Address evidence retained',
            type: 'Audit',
          },
        ],
      }),
      BookingPriorityBriefingSection({
        operatorPriorityBriefing: {
          rows: metricRows,
          status: 'Ready',
          steps: [
            {
              detail: 'Open the customer retained evidence.',
              href: '#customer',
              id: 'step-1',
              label: 'Customer',
              linkLabel: 'Open customer',
              title: 'Customer evidence',
            },
          ],
          tone: 'pill-success',
        },
      }),
    ];

    const renderedClassNames = sections.flatMap(classNamesIn);

    expect(renderedClassNames.filter((className) => className.startsWith('card admin-section admin-mb-16'))).toHaveLength(
      sections.length,
    );
    expect(normalizedText(sections)).toContain('Booking command decision strip');
    expect(normalizedText(sections)).toContain('Booking priority briefing');
  });
});
