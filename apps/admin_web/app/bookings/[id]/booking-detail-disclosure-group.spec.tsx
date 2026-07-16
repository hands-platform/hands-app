import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { BookingDetailDisclosureGroup } from './booking-detail-disclosure-group';

describe('BookingDetailDisclosureGroup', () => {
  it('uses shared Vuexy badge atoms instead of raw disclosure pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-detail-disclosure-group.tsx', 'utf8');

    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-info">{label}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{summaryItems.length} groups</span>');
    expect(source).not.toContain("<span className={`pill ${item.tone ?? 'pill-neutral'}`} key={item.label}>");
  });

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

  it('can open the selected records workspace without changing the default disclosure behavior', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailDisclosureGroup helper="Selected workspace" label="Records" open title="Operational records">
        <span>Visible record</span>
      </BookingDetailDisclosureGroup>,
    );

    expect(markup).toContain('<details class="admin-disclosure booking-detail-section-disclosure" open="">');
    expect(markup).toContain('Visible record');
  });
});
