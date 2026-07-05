import { FinanceCloseoutPayoutReleaseChecksSection } from './finance-closeout-payout-release-checks-section';

describe('FinanceCloseoutPayoutReleaseChecksSection', () => {
  it('renders handoff rows with queue links and release guidance', () => {
    const section = FinanceCloseoutPayoutReleaseChecksSection({
      rows: [
        {
          amount: '1.200.000 VND',
          count: 2,
          href: '/payouts',
          label: 'Payout batches',
          nextAction: 'Verify transfer ref, earnings, withholding logs, and Partner account state.',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'admin-table-section-body',
      className: 'admin-card-scroll',
      title: 'Payout release checks',
    });
    expect(rendered).toContain('Payout release checks');
    expect(rendered).toContain('Payout batches');
    expect(rendered).toContain('1.200.000 VND');
    expect(rendered).toContain('Verify transfer ref');
    expect(hrefsIn(section)).toContain('/payouts');
  });

  it('passes an empty message to the AdminDataTable when no handoff rows are visible', () => {
    const section = FinanceCloseoutPayoutReleaseChecksSection({ rows: [] });

    expect(textContent(section)).toContain('No finance handoff rows loaded.');
  });
});

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent([
    props?.title,
    props?.description,
    props?.statusLabel,
    props?.actions,
    props?.children,
    props?.emptyMessage,
  ]);
}

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn([props?.actions, props?.children])];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
