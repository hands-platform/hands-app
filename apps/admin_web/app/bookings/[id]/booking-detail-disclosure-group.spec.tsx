import { renderToStaticMarkup } from 'react-dom/server';

import { BookingDetailDisclosureGroup } from './booking-detail-disclosure-group';

describe('BookingDetailDisclosureGroup', () => {
  it('renders compact disclosure chrome around detailed sections', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailDisclosureGroup
        helper="Open only when an operator needs the full record."
        label="Details"
        title="Evidence and records"
      >
        <section className="card">Record body</section>
      </BookingDetailDisclosureGroup>,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('<details class="booking-detail-section-disclosure">');
    expect(markup).toContain('Details');
    expect(markup).toContain('Evidence and records');
    expect(markup).toContain('Open only when an operator needs the full record.');
    expect(markup).toContain('Record body');
  });
});
