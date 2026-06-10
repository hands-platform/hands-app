import {
  RefundCommandBoardSection,
  type RefundCommandItem,
} from './refund-command-board-section';

describe('RefundCommandBoardSection', () => {
  it('renders command cards with refund previews and warning status', () => {
    const section = RefundCommandBoardSection({
      items: buildItems(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Refund command board');
    expect(rendered).toContain('Keep customer refunds, payment ledger state');
    expect(rendered).toContain('2 refund record(s)');
    expect(rendered).toContain('Customer refund requests');
    expect(rendered).toContain('Needs operator');
    expect(rendered).toContain('REQUESTED');
    expect(rendered).toContain('2 case(s)');
    expect(rendered).toContain('refund-1 / Customer One / 200000 VND');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/refunds?review=requested']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn', 'signal signal-warn']));
  });

  it('renders a clear status when all command lanes are clear', () => {
    const section = RefundCommandBoardSection({
      items: [
        {
          detail: 'No open refund cases.',
          href: '/refunds',
          operatorAction: 'Keep monitoring.',
          refunds: [],
          status: 'Clear',
          title: 'Quiet refunds',
          tone: 'ok',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 refund record(s)');
    expect(rendered).toContain('Quiet refunds');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success', 'signal signal-ok']));
  });
});

function buildItems(): RefundCommandItem[] {
  return [
    {
      detail: 'Guests are waiting for a clear refund decision and customer-facing update.',
      href: '/refunds?review=requested',
      operatorAction: 'Confirm eligibility, payment method, and customer message.',
      refunds: [
        { amountLabel: '200000 VND', customerLabel: 'Customer One', id: 'refund-1' },
        { amountLabel: '150000 VND', customerLabel: 'Customer Two', id: 'refund-2' },
      ],
      status: 'REQUESTED',
      title: 'Customer refund requests',
      tone: 'warn',
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
