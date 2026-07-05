import { readFileSync } from 'node:fs';

describe('PartnerDetailMasterFactsSection', () => {
  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-master-facts-section.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('className="card admin-mb-16"');
    expect(source).not.toContain('<div className="ops-section-header">');
  });

  it('uses a shared badge atom for the master fact count', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-master-facts-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{facts.length} field(s)</span>');
  });

  it('keeps partner master fact finance values on the shared MoneyText atom', () => {
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(pageSource).toContain("import { MoneyText } from '../../../components/money-text';");
    expect(pageSource).toContain('value: <MoneyText amount={totalRevenue} />');
    expect(pageSource).toContain('Platform fee <MoneyText amount={platformFee} />');
    expect(pageSource).toContain('Available <MoneyText amount={payoutReadyAmount} /> / cash debt');
    expect(pageSource).toContain('<MoneyText amount={cashFeeDebtTotal} />');
    expect(pageSource).not.toContain('value: formatCurrency(totalRevenue)');
    expect(pageSource).not.toContain('helper: `Platform fee ${formatCurrency(platformFee)}`');
    expect(pageSource).not.toContain('helper: `Available ${formatCurrency(payoutReadyAmount)} / cash debt ${formatCurrency(cashFeeDebtTotal)}`');
  });
});
