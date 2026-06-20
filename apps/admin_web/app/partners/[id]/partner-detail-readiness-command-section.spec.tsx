import {
  PartnerAcceptanceRepairCommandSection,
  PartnerDetailReadinessSnapshotSection,
} from './partner-detail-readiness-command-section';

describe('partner detail readiness command sections', () => {
  it('renders the readiness gate as a Vuexy table', () => {
    const section = PartnerDetailReadinessSnapshotSection({
      snapshot: {
        badges: [
          {
            detail: 'Negative wallet balance blocks marketplace matching.',
            label: 'Cash debt',
            tone: 'blocked',
          },
          {
            detail: 'Latest location is fresh.',
            label: 'Location fresh',
            tone: 'done',
          },
        ],
        gate: {
          detail: 'Wallet is negative.',
          helper: 'Settle before marketplace.',
          label: 'GATE',
          title: 'Marketplace blocked',
        },
        status: 'Needs repair',
        tone: 'blocked',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner readiness snapshot');
    expect(rendered).toContain('Needs repair');
    expect(rendered).toContain('Cash debt');
    expect(rendered).toContain('Location fresh');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Readiness');
    expect(rendered).toContain('Operator helper');
    expect(rendered).toContain('Marketplace blocked');
    expect(rendered).toContain('Wallet is negative.');
    expect(rendered).toContain('Settle before marketplace.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'pill pill-danger']),
    );
  });

  it('renders marketplace repair steps as a Vuexy command table', () => {
    const section = PartnerAcceptanceRepairCommandSection({
      command: {
        customerImpact: 'Customer choices skip this partner.',
        marketplaceRouting: 'Route live demand to nearby ready partners.',
        operatorDecision: 'Hold matching until cash debt is cleared.',
        partnerAppMessage: 'Settle wallet balance before accepting new requests.',
        status: 'Repair required',
        steps: [
          {
            actionLabel: 'Open wallet',
            blocker: 'Negative wallet',
            href: '/partners/partner-1#wallet',
            operatorAction: 'Collect outstanding cash fee and retry marketplace check.',
            owner: 'Finance',
            reason: 'Partner wallet is below zero.',
            tone: 'blocked',
          },
          {
            actionLabel: 'Review activity',
            blocker: 'Location freshness',
            href: '/partners/partner-1#app-activity',
            operatorAction: 'No action needed.',
            owner: 'Dispatch',
            reason: 'Latest location ping is still valid.',
            tone: 'done',
          },
        ],
        tone: 'blocked',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Marketplace repair command');
    expect(rendered).toContain('Repair required');
    expect(rendered).toContain('Partner app block message');
    expect(rendered).toContain('Customer impact');
    expect(rendered).toContain('Operator decision');
    expect(rendered).toContain('Marketplace routing');
    expect(rendered).toContain('Step');
    expect(rendered).toContain('Owner / blocker');
    expect(rendered).toContain('Reason');
    expect(rendered).toContain('Operator action');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Finance : Negative wallet');
    expect(rendered).toContain('Blocks booking');
    expect(rendered).toContain('Dispatch : Location freshness');
    expect(rendered).toContain('Clear');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/partners/partner-1#wallet', '/partners/partner-1#app-activity']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-danger',
        'pill pill-success',
        'text-link',
      ]),
    );
  });

  it('keeps an empty table state when repair steps are missing', () => {
    const section = PartnerAcceptanceRepairCommandSection({
      command: {
        customerImpact: 'No impact.',
        marketplaceRouting: 'No reroute needed.',
        operatorDecision: 'Ready.',
        partnerAppMessage: 'Ready for new bookings.',
        status: 'Ready',
        steps: [],
        tone: 'done',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No repair command steps loaded.');
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
