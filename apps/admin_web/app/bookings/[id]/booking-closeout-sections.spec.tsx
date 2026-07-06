import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { BookingCloseoutSections } from './booking-closeout-sections';

describe('BookingCloseoutSections', () => {
  it('uses shared Vuexy badge atoms instead of raw closeout pill spans and links', () => {
    const source = readFileSync('app/bookings/[id]/booking-closeout-sections.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('DateTimeText');
    expect(source).toContain('closeoutChecklistDetail(item)');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).toContain('AdminActionCard');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-12">');
    expect(source).not.toContain('<Link className={`ops-task-card');
    expect(source).not.toContain('<span className={`pill ${item.pillClass}`}>{item.status}</span>');
    expect(source).not.toContain('<span className="pill pill-info">{connectedRecordLinks.length} links</span>');
    expect(source).not.toContain('<Link className={`pill ${record.tone}`} href={record.href}>');
  });

  it('renders checklist timestamp details through the shared date atom', () => {
    const markup = renderToStaticMarkup(
      <BookingCloseoutSections
        bookingCloseoutChecklist={[
          {
            className: 'ops-task-done',
            detail: 'Room room_123 keeps 3 message(s); latest',
            detailDateTimeFallback: '07 Jun 2026 10:30',
            detailDateTimeSuffix: '.',
            detailDateTimeValue: '2026-06-07T03:30:00.000Z',
            href: '#chat',
            operatorRule: 'Retain admin transcript.',
            pillClass: 'pill-success',
            status: 'Archived',
            title: 'Chat archive',
          },
        ]}
        connectedRecordLinks={[]}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('class="date-time-text"');
    expect(markup).toContain('dateTime="2026-06-07T03:30:00.000Z"');
    expect(markup).toContain('Room room_123 keeps 3 message(s); latest');
  });

  it('renders closeout checklist and connected records on shared Vuexy section surfaces', () => {
    const markup = renderToStaticMarkup(
      <BookingCloseoutSections
        bookingCloseoutChecklist={[
          {
            className: 'is-warning',
            detail: 'Payment needs finance review.',
            href: '#finance',
            operatorRule: 'Confirm settlement before closeout.',
            pillClass: 'pill-warn',
            status: 'Pending',
            title: 'Finance closeout',
          },
        ]}
        connectedRecordLinks={[
          {
            detail: 'Booking lifecycle events.',
            href: '#booking-activity',
            label: 'Activity',
            tone: 'pill-info',
            value: '12',
          },
        ]}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('card admin-section admin-mb-16 booking-closeout-checklist-card');
    expect(markup).toContain('card admin-section admin-mb-16 connected-operations-records-card');
    expect(markup).toContain('Booking closeout checklist');
    expect(markup).toContain('Connected operations records');
    expect(markup).toContain('Manual decision queue');
    expect(markup).toContain('Finance closeout');
    expect(markup).toContain('1 links');
    expect(markup).toContain('href="#booking-activity"');
  });
});
