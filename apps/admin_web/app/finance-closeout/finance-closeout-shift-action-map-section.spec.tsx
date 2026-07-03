import { FinanceCloseoutShiftActionMapSection } from './finance-closeout-shift-action-map-section';
import { renderToStaticMarkup } from 'react-dom/server';

describe('FinanceCloseoutShiftActionMapSection', () => {
  it('renders shift close actions with status, reason, and operator rule', () => {
    const section = FinanceCloseoutShiftActionMapSection({
      items: [
        {
          action: 'Payment close',
          href: '/payments?review=needs-action',
          operatorRule: 'Capture, release, refund, or record cash settlement evidence before handoff.',
          pillClass: 'pill-warn',
          reason: '1 authorization hold remains open.',
          status: '1 open',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Shift close action map');
    expect(rendered).toContain('Payment close');
    expect(rendered).toContain('1 open');
    expect(rendered).toContain('1 authorization hold remains open.');
    expect(rendered).toContain('Capture, release, refund');
    expect(hrefsIn(section)).toContain('/operations-handoff');
  });

  it('normalizes legacy action pill classes without duplicating the pill prefix', () => {
    const section = FinanceCloseoutShiftActionMapSection({
      items: [
        {
          action: 'Payment close',
          href: '/payments?review=needs-action',
          operatorRule: 'Capture, release, refund, or record cash settlement evidence before handoff.',
          pillClass: 'pill pill-warn',
          reason: '1 authorization hold remains open.',
          status: '1 open',
        },
      ],
    });

    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('class="pill pill-warn"');
    expect(markup).not.toContain('pill pill pill-warn');
  });

  it('renders an empty state when no shift close action is visible', () => {
    const section = FinanceCloseoutShiftActionMapSection({ items: [] });

    expect(textContent(section)).toContain('No shift close action is visible for this range.');
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
  return textContent(props?.children);
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
  return [...href, ...hrefsIn(props?.children)];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
