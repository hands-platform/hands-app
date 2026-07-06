import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { BookingActivityPanel, BookingFullRecordIndex } from './booking-activity-panel';

describe('BookingActivityPanel', () => {
  it('uses the shared Vuexy empty-state atom for empty activity', () => {
    const source = readFileSync('app/bookings/[id]/booking-activity-panel.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No booking activity has been recorded yet</strong>');
  });

  it('uses shared Vuexy badge atoms instead of raw booking activity pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-activity-panel.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{eventCount} event(s)</span>');
    expect(source).not.toContain('<span className="pill pill-info">{totalRecordCount} event(s)</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{record.type}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">NONE</span>');
  });

  it('uses the shared DateTimeText atom for visible booking activity timestamps', () => {
    const source = readFileSync('app/bookings/[id]/booking-activity-panel.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('<small>{formatDate(record.at)}</small>');
  });

  it('uses the shared Vuexy text link atom for activity record links', () => {
    const source = readFileSync('app/bookings/[id]/booking-activity-panel.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders the full record index on the shared Vuexy section surface', () => {
    const markup = renderToStaticMarkup(
      <BookingFullRecordIndex
        bookingId="booking_123456789"
        cards={[
          {
            href: '#booking-activity',
            label: 'Activity',
            value: '2',
            helper: 'Latest operational records.',
          },
        ]}
        csvHref="/api/admin/bookings/booking_123456789/activity.csv"
        eventCount={2}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('card admin-section admin-mb-16 booking-full-record-index-card');
    expect(markup).toContain('Booking full record index');
    expect(markup).toContain('Export activity CSV');
    expect(markup).toContain('2 event(s)');
  });

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

    expect(markup).toContain('card admin-section admin-mt-16 booking-activity-card');
    expect(markup).toContain('booking-activity-record-list admin-mt-12');
    expect(markup).toContain('booking-activity-record-row');
    expect(markup).toContain('pill pill-neutral');
    expect(markup).toContain('Partner entered marketplace shortlist');
    expect(markup).toContain('href="/partners/partner-1"');
    expect(markup).not.toContain('setup-stage-list');
    expect(markup).not.toContain('setup-stage-item');
  });

  it('shows the full activity count when only preview rows are rendered', () => {
    const markup = renderToStaticMarkup(
      <BookingActivityPanel
        records={[
          {
            id: 'activity-1',
            type: 'ALERT',
            at: '2026-06-19T14:40:00.000Z',
            title: 'Notification sent',
            detail: 'Partner invite delivery recorded.',
          },
        ]}
        summary={[
          {
            label: 'Ops and alerts',
            value: '12',
            helper: 'Operator notes, audit events, and notification delivery events.',
          },
        ]}
        totalRecordCount={12}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('12 event(s)');
    expect(markup).toContain('Showing latest 1 of 12 events in-page.');
    expect(markup).toContain('Notification sent');
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
