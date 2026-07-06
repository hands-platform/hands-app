import { readFileSync } from 'node:fs';

describe('PartnerDetailOpsCommandCenterSection', () => {
  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-ops-command-center-section.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('className="card admin-mb-16"');
    expect(source).not.toContain("<span className={`pill ${summary.ready ? 'pill-success' : 'pill-warn'}`}>");
    expect(source).not.toContain('<span className={`pill ${pillClassForTone(card.tone)}`}>{card.status}</span>');
  });
});
