import {
  PartnerDetailSummaryRailSection,
  type PartnerDetailSummaryRailItem,
} from './partner-detail-summary-rail-section';

describe('PartnerDetailSummaryRailSection', () => {
  it('renders summary rail items with links and status label', () => {
    const section = PartnerDetailSummaryRailSection({
      description: 'Fast facts for operators before opening the full partner record.',
      id: 'partner-summary',
      items: buildItems(),
      statusLabel: 'Above-fold summary',
      title: 'Partner operator first read',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Partner operator first read');
    expect(rendered).toContain('Fast facts for operators before opening the full partner record.');
    expect(rendered).toContain('Above-fold summary');
    expect(rendered).toContain('Identity');
    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('Wallet and payout');
    expect(rendered).toContain('Payout gate clear.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#partner-master-facts', '#payout']));
  });
});

function buildItems(): PartnerDetailSummaryRailItem[] {
  return [
    {
      detail: '+84900000000 / joined 9 Jun 2026',
      href: '#partner-master-facts',
      label: 'Identity',
      value: 'Massage Partner',
    },
    {
      detail: 'Payout gate clear.',
      href: '#payout',
      label: 'Wallet and payout',
      value: 'READY',
    },
  ];
}

function textContent(value: unknown): string {
  value = resolveElement(value);
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
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
