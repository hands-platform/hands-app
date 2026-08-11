import { readFileSync } from 'node:fs';

describe('PartnerDetailMasterFactsSection', () => {
  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-master-facts-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
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
    const modelSource = readFileSync('app/partners/[id]/partner-detail-record-summary-model.tsx', 'utf8');

    expect(modelSource).toContain("import { MoneyText } from '../../../components/money-text';");
    expect(modelSource).toContain('value: <MoneyText amount={totalRevenue} />');
    expect(modelSource).toContain('Platform fee <MoneyText amount={platformFee} />');
    expect(modelSource).toContain('Available <MoneyText amount={payoutReadyAmount} /> / cash debt');
    expect(modelSource).toContain('<MoneyText amount={cashFeeDebtTotal} />');
    expect(modelSource).not.toContain('value: formatCurrency(totalRevenue)');
    expect(modelSource).not.toContain('helper: `Platform fee ${formatCurrency(platformFee)}`');
    expect(modelSource).not.toContain(
      'helper: `Available ${formatCurrency(payoutReadyAmount)} / cash debt ${formatCurrency(cashFeeDebtTotal)}`',
    );
  });

  it('keeps partner master fact date values on the shared DateTimeText atom', () => {
    const sectionSource = readFileSync('app/partners/[id]/partner-detail-master-facts-section.tsx', 'utf8');
    const modelSource = readFileSync('app/partners/[id]/partner-detail-record-summary-model.tsx', 'utf8');

    expect(modelSource).toContain("import { DateTimeText } from '../../../components/date-time-text';");
    expect(modelSource).toContain('<DateTimeText fallback="Missing" value={provider.dateOfBirth} />');
    expect(sectionSource).toContain('readonly valueDateTimeFallback?: string;');
    expect(sectionSource).toContain('readonly valueDateTimeValue?: string | null;');
    expect(sectionSource).toContain('valueDateTimeFallback: fact.valueDateTimeFallback');
    expect(sectionSource).toContain('valueDateTimeValue: fact.valueDateTimeValue');
    expect(modelSource).toContain("valueDateTimeFallback: 'Missing'");
    expect(modelSource).toContain('valueDateTimeValue: provider.user?.createdAt');
    expect(modelSource).toContain(
      '<DateTimeText fallback="No app session recorded" value={latestAccessAt} />',
    );
    expect(modelSource).not.toContain(
      'value: <DateTimeText fallback="Missing" value={provider.user?.createdAt} />',
    );
    expect(modelSource).not.toContain(
      "value: `${provider.gender ?? 'Not saved'} / ${formatDate(provider.dateOfBirth)}`",
    );
    expect(modelSource).not.toContain('value: formatDate(provider.user?.createdAt)');
    expect(modelSource).not.toContain(
      "helper: latestAccessAt ? `Recent app access ${formatDate(latestAccessAt)}` : 'No app session recorded'",
    );
  });
});
