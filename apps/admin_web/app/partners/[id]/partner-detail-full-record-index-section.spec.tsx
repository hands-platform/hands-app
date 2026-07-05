import { readFileSync } from 'node:fs';

describe('PartnerDetailFullRecordIndexSection', () => {
  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-full-record-index-section.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('className="card admin-mb-16"');
    expect(source).not.toContain('<div className="ops-section-header">');
  });

  it('uses a shared badge atom for the booking record count', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-full-record-index-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{bookingRecordCount} booking record(s)</span>');
    expect(source).toContain("import type { ReactNode } from 'react';");
    expect(source).toContain('readonly cashDebtLabel: ReactNode;');
    expect(pageSource).toContain('cashDebtLabel={<MoneyText amount={cashFeeDebtTotal} />}');
  });
});
