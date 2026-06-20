import { renderToStaticMarkup } from 'react-dom/server';

import { BookingPayoutBatchEligibilitySection } from './booking-finance-trace-sections';

describe('BookingPayoutBatchEligibilitySection', () => {
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
              label: 'Closeout readiness',
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
    expect(markup).toContain('Closeout readiness');
    expect(markup).toContain('href="#booking-closeout-readiness"');
    expect(markup).not.toContain('ops-task-card');
  });
});
