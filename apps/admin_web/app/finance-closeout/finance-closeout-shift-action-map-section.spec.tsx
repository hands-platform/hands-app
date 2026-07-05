import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'setup-stage-list admin-mt-12',
      className: 'admin-mb-16',
      title: 'Shift close action map',
    });
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
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('No shift close action is visible for this range.');
    expect(markup).toContain('class="empty-state');
  });

  it('uses shared status badges for shift close action status', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-closeout/finance-closeout-shift-action-map-section.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
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
