import { FinanceCloseoutEvidenceChecklistSection } from './finance-closeout-evidence-checklist-section';
import { renderToStaticMarkup } from 'react-dom/server';

describe('FinanceCloseoutEvidenceChecklistSection', () => {
  it('renders checklist items with operator rules and handoff link', () => {
    const section = FinanceCloseoutEvidenceChecklistSection({
      items: [
        {
          className: 'ops-task-pending',
          detail: 'Holds and cash pending rows must match booking outcomes.',
          href: '/payments',
          operatorRule: 'Do not close the shift while an unexplained payment state remains open.',
          pillClass: 'pill-warn',
          status: '2 open',
          title: 'Payment state',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'ops-task-grid',
      className: 'admin-mb-16',
      title: 'Finance closeout evidence checklist',
    });
    expect(rendered).toContain('Finance closeout evidence checklist');
    expect(rendered).toContain('Payment state');
    expect(rendered).toContain('2 open');
    expect(rendered).toContain('Do not close the shift');
    expect(hrefsIn(section)).toContain('/operations-handoff');
  });

  it('normalizes legacy checklist pill classes without duplicating the pill prefix', () => {
    const section = FinanceCloseoutEvidenceChecklistSection({
      items: [
        {
          className: 'ops-task-pending',
          detail: 'Payment review still has open evidence.',
          href: '/payments',
          operatorRule: 'Keep the closeout open until payment evidence is reviewed.',
          pillClass: 'pill pill-warn',
          status: 'Needs review',
          title: 'Payment evidence',
        },
      ],
    });

    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('class="pill pill-warn"');
    expect(markup).not.toContain('pill pill pill-warn');
  });

  it('renders an empty state when no evidence checklist item is visible', () => {
    const section = FinanceCloseoutEvidenceChecklistSection({ items: [] });

    expect(textContent(section)).toContain('No finance closeout evidence item is visible for this range.');
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
  return textContent([props?.title, props?.description, props?.statusLabel, props?.actions, props?.children]);
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
