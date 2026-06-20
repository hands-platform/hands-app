import {
  PartnerDetailOperationsDigestSection,
  type PartnerOperationsDigestRow,
} from './partner-detail-operations-digest-section';

describe('PartnerDetailOperationsDigestSection', () => {
  it('renders digest lanes with evidence, links, and latest dates', () => {
    const section = PartnerDetailOperationsDigestSection({
      description: 'One-screen factual digest for partner operations.',
      formatLatestAt: (value) => `formatted ${value}`,
      id: 'partner-operations-digest',
      rows: buildRows(),
      title: 'Partner operations digest',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operations digest');
    expect(rendered).toContain('One-screen factual digest for partner operations.');
    expect(rendered).toContain('2 lanes');
    expect(rendered).toContain('Lane');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Evidence');
    expect(rendered).toContain('Latest');
    expect(rendered).toContain('Identity');
    expect(rendered).toContain('Verified');
    expect(rendered).toContain('KYC approved');
    expect(rendered).toContain('Chat');
    expect(rendered).toContain('No date');
    expect(rendered).toContain('formatted 2026-06-09T04:00:00.000Z');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#identity', '#chat']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'pill pill-success', 'pill pill-neutral', 'text-link']),
    );
  });

  it('renders an empty operations digest table state', () => {
    const section = PartnerDetailOperationsDigestSection({
      description: 'One-screen factual digest for partner operations.',
      formatLatestAt: (value) => `formatted ${value}`,
      id: 'partner-operations-digest',
      rows: [],
      title: 'Partner operations digest',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operations digest');
    expect(rendered).toContain('0 lanes');
    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No partner operations digest lanes are currently loaded.');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table']));
  });
});

function buildRows(): PartnerOperationsDigestRow[] {
  return [
    {
      detail: 'Partner profile is ready for marketplace operations.',
      evidence: ['KYC approved', 'Bank approved'],
      href: '#identity',
      lane: 'Identity',
      latestAt: '2026-06-09T04:00:00.000Z',
      status: 'Verified',
      tone: 'pill-success',
    },
    {
      detail: 'No retained chat room loaded for this date filter.',
      evidence: ['0 room(s)'],
      href: '#chat',
      lane: 'Chat',
      status: 'No room',
      tone: 'pill-neutral',
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
