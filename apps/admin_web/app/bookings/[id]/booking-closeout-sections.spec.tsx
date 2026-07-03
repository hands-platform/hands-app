import { renderToStaticMarkup } from 'react-dom/server';

import { BookingCloseoutSections } from './booking-closeout-sections';

describe('BookingCloseoutSections', () => {
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
