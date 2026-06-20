import { renderToStaticMarkup } from 'react-dom/server';

import { BookingActivityPanel } from './booking-activity-panel';

describe('BookingActivityPanel', () => {
  it('renders booking activity as compact record rows', () => {
    const markup = renderToStaticMarkup(
      <BookingActivityPanel
        records={[
          {
            id: 'activity-1',
            type: 'PARTNER',
            at: '2026-06-19T14:40:00.000Z',
            title: 'Partner entered marketplace shortlist',
            detail: 'Accepted / 2.1 km / online',
            href: '/partners/partner-1',
          },
          {
            id: 'activity-2',
            type: 'LOCATION',
            at: '2026-06-19T14:45:00.000Z',
            title: 'Partner booking action location',
            detail: 'District 1, Ho Chi Minh City',
          },
        ]}
        summary={[
          {
            label: 'Matching',
            value: '1',
            helper: 'Partner participation and final selection.',
          },
        ]}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('booking-activity-record-list admin-mt-12');
    expect(markup).toContain('booking-activity-record-row');
    expect(markup).toContain('pill pill-neutral');
    expect(markup).toContain('Partner entered marketplace shortlist');
    expect(markup).toContain('href="/partners/partner-1"');
    expect(markup).not.toContain('setup-stage-list');
    expect(markup).not.toContain('setup-stage-item');
  });

  it('renders the empty state with the same record row structure', () => {
    const markup = renderToStaticMarkup(
      <BookingActivityPanel
        records={[]}
        summary={[
          {
            label: 'Matching',
            value: '0',
            helper: 'No activity loaded.',
          },
        ]}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('booking-activity-record-row is-empty');
    expect(markup).toContain('No booking activity has been recorded yet');
    expect(markup).not.toContain('setup-stage-list');
    expect(markup).not.toContain('setup-stage-item');
  });
});
