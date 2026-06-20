import { PartnerDetailAcceptanceUnblockPlaybookSection } from './partner-detail-acceptance-unblock-playbook-section';

describe('PartnerDetailAcceptanceUnblockPlaybookSection', () => {
  it('renders marketplace and payout unblock steps as a Vuexy table', () => {
    const section = PartnerDetailAcceptanceUnblockPlaybookSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      steps: [
        {
          action: 'Settle wallet',
          bookingBlocked: false,
          bookingImpact:
            'Marketplace visibility and participation stay open; final acceptance and service start wait for settlement.',
          detail: 'Cash fee debt is below zero and must be collected.',
          href: '#wallet',
          id: 'cash-debt',
          owner: 'Finance',
          payoutImpact: 'Payout release stays locked while balance is negative.',
          status: 'Settlement warning',
          step: '1',
          title: 'Clear cash fee debt',
          tone: 'pending',
        },
        {
          action: 'Review KYC',
          bookingBlocked: false,
          bookingImpact: 'No dispatch block after approval.',
          detail: 'KYC record is pending operator review.',
          href: '#kyc',
          id: 'kyc',
          owner: 'KYC',
          payoutImpact: 'Payout can continue after review clears.',
          status: 'Operator check',
          step: '2',
          title: 'Approve identity',
          tone: 'pending',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner approval, settlement, and payout playbook');
    expect(rendered).toContain('0 booking blocker(s)');
    expect(rendered).toContain('Step');
    expect(rendered).toContain('Unblock item');
    expect(rendered).toContain('Booking impact');
    expect(rendered).toContain('Payout impact');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Clear cash fee debt');
    expect(rendered).toContain('Cash fee debt is below zero and must be collected.');
    expect(rendered).toContain(
      'Marketplace visibility and participation stay open; final acceptance and service start wait for settlement.',
    );
    expect(rendered).toContain('Settlement warning');
    expect(rendered).toContain('Payout release stays locked while balance is negative.');
    expect(rendered).toContain('Approve identity');
    expect(rendered).toContain('Operator check');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#wallet', '#kyc']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-success',
        'pill pill-info',
        'pill pill-pending',
        'text-link',
      ]),
    );
  });

  it('renders an empty playbook state in the table', () => {
    const section = PartnerDetailAcceptanceUnblockPlaybookSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      steps: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 booking blocker(s)');
    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No marketplace or payout unblock steps are currently required.');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table']));
  });
});

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

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
