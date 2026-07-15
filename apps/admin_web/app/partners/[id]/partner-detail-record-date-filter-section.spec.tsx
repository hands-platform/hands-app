import { readFileSync } from 'node:fs';

describe('PartnerDetailRecordDateFilterSection', () => {
  it('uses the shared Vuexy trace summary atom for filtered record counts', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-record-date-filter-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses the shared Vuexy filter panel surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-record-date-filter-section.tsx', 'utf8');

    expect(source).toContain('AdminFilterPanel');
    expect(source).toContain('className="partner-record-date-filter-panel admin-mb-16"');
    expect(source).not.toContain('AdminCard');
    expect(source).not.toContain('AdminSectionHeader');
    expect(source).not.toContain('<AdminCard className="admin-mb-16" id="record-date-filter">');
    expect(source).not.toContain('className="card admin-mb-16"');
    expect(source).not.toContain('<div className="ops-section-header">');
  });

  it('uses the shared Vuexy filter summary atom for active filter chips', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-record-date-filter-section.tsx', 'utf8');

    expect(source).toContain('AdminFilterSummary');
    expect(source).not.toContain('AdminFilterChipGroup');
    expect(source).not.toContain('StatusBadge');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className="pill pill-info">{dateFilters.label}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{activityTypeLabel}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{activityOrderLabel(activityOrder)}</span>');
  });
});
