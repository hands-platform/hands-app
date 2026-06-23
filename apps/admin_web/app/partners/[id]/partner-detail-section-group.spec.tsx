import { PartnerDetailSectionGroup } from './partner-detail-section-group';

describe('PartnerDetailSectionGroup', () => {
  it('renders a titled operations section with status and children', () => {
    const section = PartnerDetailSectionGroup({
      children: <div>Grouped partner content</div>,
      description: 'Partner operations grouped for a faster first read.',
      eyebrow: 'Control',
      id: 'partner-control-section',
      status: '4 command(s)',
      title: 'Partner control workspace',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Control');
    expect(rendered).toContain('Partner control workspace');
    expect(rendered).toContain('Partner operations grouped for a faster first read.');
    expect(rendered).toContain('4 command(s)');
    expect(rendered).toContain('Grouped partner content');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'partner-detail-section-band partner-detail-section-group',
        'partner-detail-section-band-header',
        'partner-detail-section-band-body partner-detail-section-group-body',
      ]),
    );
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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
