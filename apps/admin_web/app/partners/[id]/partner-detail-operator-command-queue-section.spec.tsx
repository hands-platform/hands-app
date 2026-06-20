import { PartnerDetailOperatorCommandQueueSection } from './partner-detail-operator-command-queue-section';

describe('PartnerDetailOperatorCommandQueueSection', () => {
  it('renders operator commands as a Vuexy table', () => {
    const section = PartnerDetailOperatorCommandQueueSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      providerId: 'partner-1',
      queue: {
        commands: [
          {
            action: {
              href: '#wallet',
              label: 'Open wallet',
              type: 'link',
            },
            detail: 'Partner wallet must be settled before marketplace routing.',
            id: 'wallet',
            label: '1',
            owner: 'Finance',
            title: 'Cash fee debt',
            tone: 'blocked',
          },
          {
            action: {
              label: 'Approve KYC',
              type: 'approve-kyc',
            },
            detail: 'KYC evidence is complete and ready for approval.',
            id: 'kyc',
            label: '2',
            owner: 'Review',
            title: 'KYC approval',
            tone: 'pending',
          },
        ],
        metrics: [
          {
            helper: 'Commands blocking direct and marketplace bookings.',
            label: 'Blocked',
            value: '1',
          },
        ],
        status: '1 blocked',
        tone: 'blocked',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operator command queue');
    expect(rendered).toContain('1 blocked');
    expect(rendered).toContain('Blocked');
    expect(rendered).toContain('Queue');
    expect(rendered).toContain('Command');
    expect(rendered).toContain('Owner');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Cash fee debt');
    expect(rendered).toContain('Partner wallet must be settled before marketplace routing.');
    expect(rendered).toContain('KYC approval');
    expect(rendered).toContain('KYC evidence is complete and ready for approval.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '#wallet',
        '/partners/partner-1?section=full&providerId=partner-1&reviewAction=approve-kyc',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-blocked',
        'pill pill-pending',
        'text-link',
      ]),
    );
  });

  it('renders an empty command table state', () => {
    const section = PartnerDetailOperatorCommandQueueSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      providerId: 'partner-1',
      queue: {
        commands: [],
        metrics: [],
        status: 'Ready',
        tone: 'done',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No same-shift partner command is currently queued.');
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
