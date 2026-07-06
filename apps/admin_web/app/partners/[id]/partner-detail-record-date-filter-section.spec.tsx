import { readFileSync } from 'node:fs';

describe('PartnerDetailRecordDateFilterSection', () => {
  it('uses the shared Vuexy trace summary atom for filtered record counts', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-record-date-filter-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-record-date-filter-section.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('className="card admin-mb-16"');
    expect(source).not.toContain('<div className="ops-section-header">');
  });

  it('uses shared Vuexy badge atoms for active filter chips', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-record-date-filter-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{dateFilters.label}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{activityTypeLabel}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{activityOrderLabel(activityOrder)}</span>');
  });
});
