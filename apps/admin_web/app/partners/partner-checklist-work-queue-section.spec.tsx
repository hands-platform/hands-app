import {
  PartnerChecklistWorkQueueSection,
  type PartnerChecklistWorkQueueSectionQueue,
} from './partner-checklist-work-queue-section';

describe('PartnerChecklistWorkQueueSection', () => {
  it('renders partner checklist queue counters, row facts, and detail links', () => {
    const section = PartnerChecklistWorkQueueSection({
      partnerName: (provider) => provider.displayName,
      queue: buildQueue(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner checklist work queue');
    expect(rendered).toContain('2 urgent');
    expect(rendered).toContain('1 blocked');
    expect(rendered).toContain('3 dispatch-ready');
    expect(rendered).toContain('# 1');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('KYC decision');
    expect(rendered).toContain('KYC');
    expect(rendered).toContain('Review submitted KYC evidence.');
    expect(rendered).toContain('Same shift');
    expect(rendered).toContain('Submitted 2h ago.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1#kyc']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-danger', 'text-link']));
  });

  it('renders an empty queue state when no partner work items are visible', () => {
    const section = PartnerChecklistWorkQueueSection({
      partnerName: (provider) => provider.displayName,
      queue: {
        blockedCount: 0,
        dispatchReadyCount: 0,
        rows: [],
        urgentCount: 0,
      },
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 urgent');
    expect(rendered).toContain('No partner work queue items');
    expect(rendered).toContain('Keep monitoring dispatch demand and live booking pressure.');
  });
});

function buildQueue(): PartnerChecklistWorkQueueSectionQueue {
  return {
    blockedCount: 1,
    dispatchReadyCount: 3,
    rows: [
      {
        action: {
          detail: 'Review submitted KYC evidence.',
          operatorAction: 'Approve or reject KYC.',
          priority: 95,
          status: 'KYC',
          tone: 'blocked',
        },
        age: 'Submitted 2h ago.',
        href: '/partners/partner-1#kyc',
        lane: 'KYC decision',
        provider: {
          displayName: 'Linh Wellness',
          id: 'partner-1',
          status: 'ONLINE_AVAILABLE',
          user: {
            phone: '0865907184',
          },
        },
        sla: 'Same shift',
        tone: 'danger',
      },
    ],
    urgentCount: 2,
  };
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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
