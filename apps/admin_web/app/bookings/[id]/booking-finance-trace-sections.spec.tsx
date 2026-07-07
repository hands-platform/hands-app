import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  BookingAlertTraceSection,
  BookingAttentionChecksSection,
  BookingFinanceCommandCenterSection,
  BookingOperationsAuditTraceSection,
  BookingPayoutBatchEligibilitySection,
  BookingServicePricingSnapshotSection,
} from './booking-finance-trace-sections';

describe('BookingPayoutBatchEligibilitySection', () => {
  it('uses shared Vuexy badge atoms instead of raw finance trace pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-finance-trace-sections.tsx', 'utf8');

    expect(source).toContain('AdminMetricGrid');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).not.toContain('<div className="grid admin-mt-12">');
    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminSignal');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(source).not.toContain('<span className="signal signal-info">{batch.signal}</span>');
    expect(source).not.toContain('<span className={`signal ${row.signalClass}`}>{row.signal}</span>');
    expect(source).not.toContain('<span className={`pill ${attentionToneClass(flag.severity)}`}>');
    expect(source).not.toContain('<span className={`pill ${operationsTrace.statusTone}`}>{operationsTrace.status}</span>');
    expect(source).not.toContain('actions={<span className={`pill ${attentionSummary.tone}`}>{attentionSummary.label}</span>}');
    expect(source).not.toContain('<span className={`pill ${row.pillClass}`}>{row.status}</span>');
  });

  it('renders payout checks as a compact settlement ledger', () => {
    const markup = renderToStaticMarkup(
      <BookingPayoutBatchEligibilitySection
        payoutBatchEligibility={{
          status: 'Review',
          summary: 'Review payout readiness before release.',
          tone: 'pill-warn',
          rows: [
            {
              className: 'ops-task-warning',
              detail: 'Booking closeout still has one review item.',
              href: '#booking-closeout-readiness',
              label: 'Closeout status',
              operatorRule: 'Use retained booking evidence before including the earning in settlement batches.',
              pillClass: 'pill-warn',
              status: '1 item',
            },
          ],
        }}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Payout batch eligibility');
    expect(markup).toContain('booking-settlement-ledger');
    expect(markup).toContain('aria-label="Payout batch eligibility rows"');
    expect(markup).toContain('Closeout status');
    expect(markup).toContain('href="#booking-closeout-readiness"');
    expect(markup).not.toContain('ops-task-card');
  });

  it('renders booking finance trace panels with the shared Vuexy admin section surface', () => {
    const markup = renderToStaticMarkup(
      <>
        <BookingAlertTraceSection
          bookingId="booking-1"
          notificationTrace={{ backupBatches: [], metrics: [], rows: [] }}
        />
        <BookingOperationsAuditTraceSection
          bookingId="booking-1"
          operationsTrace={{
            detail: 'No policy updates after booking creation.',
            metrics: [],
            rows: [],
            status: 'Clear',
            statusTone: 'pill-success',
            title: 'Policy aligned',
          }}
        />
        <BookingAttentionChecksSection
          attentionFlags={[]}
          attentionSummary={{ label: 'Clear', tone: 'pill-success' }}
        />
        <BookingFinanceCommandCenterSection
          financeFlags={[]}
          financeSummaryCards={[{ helper: 'No finance issue.', label: 'Finance', value: 'Clear' }]}
        />
        <BookingPayoutBatchEligibilitySection
          payoutBatchEligibility={{
            rows: [],
            status: 'Ready',
            summary: 'Payout batch eligibility is clear.',
            tone: 'pill-success',
          }}
        />
        <BookingServicePricingSnapshotSection
          financeFlags={[]}
          servicePricingSnapshotRows={[{ helper: 'Base price retained.', label: 'Price', value: '100,000 VND' }]}
        />
      </>,
    ).replace(/\s+/g, ' ');

    expect(markup.match(/class="card admin-section/g)).toHaveLength(6);
    expect(markup).toContain('Booking alert records');
    expect(markup).not.toContain('Booking alert trace');
    expect(markup).toContain('Operations audit records');
    expect(markup).not.toContain('Operations audit trace');
    expect(markup).toContain('Finance command center');
    expect(markup).toContain('Service pricing evidence');
    expect(markup).toContain('No active attention checks. Continue normal monitoring from the timeline.');
    expect(markup).toContain('class="empty-state');
  });

  it('renders notification trace created times through the shared DateTimeText atom', () => {
    const source = readFileSync('app/bookings/[id]/booking-finance-trace-sections.tsx', 'utf8');
    const markup = renderToStaticMarkup(
      <BookingAlertTraceSection
        bookingId="booking-1"
        notificationTrace={{
          backupBatches: [
            {
              createdAtLabel: 'Not set',
              createdAtValue: '2026-06-14T02:10:00.000Z',
              detail: 'Two Partners were invited.',
              id: 'batch-1',
              meta: 'radius 5 km',
              signal: 'Marketplace invited',
              title: 'Marketplace alert batch',
            },
          ],
          metrics: [],
          rows: [
            {
              createdAtLabel: 'Not set',
              createdAtValue: '2026-06-14T02:12:00.000Z',
              detail: 'Partner was notified.',
              id: 'notification-1',
              meta: 'Booking requested',
              signal: 'Delivered',
              signalClass: 'signal-ok',
              title: 'Booking requested / Partner One',
            },
          ],
        }}
      />,
    ).replace(/\s+/g, ' ');

    expect(source).toContain("import { DateTimeText } from '../../../components/date-time-text';");
    expect(markup.match(/class="date-time-text"/g)).toHaveLength(2);
    expect(markup).toContain('Created <time');
    expect(markup).toContain('dateTime="2026-06-14T02:10:00.000Z"');
    expect(markup).toContain('dateTime="2026-06-14T02:12:00.000Z"');
  });
});
