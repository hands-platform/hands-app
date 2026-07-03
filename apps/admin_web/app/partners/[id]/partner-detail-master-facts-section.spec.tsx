import { readFileSync } from 'node:fs';

describe('PartnerDetailMasterFactsSection', () => {
  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-master-facts-section.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).not.toContain('className="card admin-mb-16"');
  });

  it('uses a shared badge atom for the master fact count', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-master-facts-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{facts.length} field(s)</span>');
  });
});
