import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizedText } from './booking-section-test-utils';
import { BookingCompletedCloseoutSection } from './booking-completed-closeout-section';

describe('BookingCompletedCloseoutSection', () => {
  it('scopes completed closeout operator note copy to the direct note slot', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.booking-post-match-operator-note > span');
    expect(css).not.toContain('.booking-post-match-operator-note span');
  });

  it('renders completed booking closeout guidance', () => {
    const markup = renderToStaticMarkup(<BookingCompletedCloseoutSection />);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Completed closeout flow');
    expect(rendered).toContain('Completed bookings stay here until service evidence');
    expect(rendered).toContain('1. Confirm service record');
    expect(rendered).toContain('Completion evidence');
    expect(rendered).toContain('Partner completion location');
    expect(rendered).toContain('2. Check closeout records');
    expect(rendered).toContain('Closeout readiness');
    expect(rendered).toContain('3. Keep audit trail');
    expect(rendered).toContain('Completed detail');
    expect(rendered).toContain('Admin handling rule');
    expect(rendered).toContain('normal closeout review');
    expect(markup).toContain('admin-section');
    expect(markup).toContain('booking-completed-closeout-card');
    expect(markup).toContain('aria-label="Completed closeout flow"');
    expect(markup).toContain('booking-post-match-decision-flow');
    expect(markup).toContain('booking-post-match-decision-step');
  });
});
