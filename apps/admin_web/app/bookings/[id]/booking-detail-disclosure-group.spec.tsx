import { renderToStaticMarkup } from 'react-dom/server';

import { BookingDetailDisclosureGroup } from './booking-detail-disclosure-group';

describe('BookingDetailDisclosureGroup', () => {
  it('renders compact disclosure chrome around detailed sections', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailDisclosureGroup
        helper="Open only when an operator needs the full record."
        label="Details"
        summaryItems={[
          { label: 'Evidence', tone: 'pill-info' },
          { label: 'Settlement', tone: 'pill-neutral' },
        ]}
        title="Evidence and records"
      >
        <section className="card">Record body</section>
      </BookingDetailDisclosureGroup>,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('<details class="admin-disclosure booking-detail-section-disclosure">');
    expect(markup).toContain(
      '<summary aria-label="Details: Evidence and records. Open only when an operator needs the full record. 2 groups: Evidence, Settlement."',
    );
    expect(markup).toContain('class="booking-detail-section-summary-copy"');
    expect(markup).toContain('class="booking-detail-section-summary-meta"');
    expect(markup).toContain('2 groups');
    expect(markup).toContain('Details');
    expect(markup).toContain('Evidence');
    expect(markup).toContain('Settlement');
    expect(markup).toContain('Evidence and records');
    expect(markup).toContain('Open only when an operator needs the full record.');
    expect(markup).toContain('Record body');
  });
});
